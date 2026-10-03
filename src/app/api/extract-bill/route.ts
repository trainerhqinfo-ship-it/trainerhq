import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ExtractedBillData {
  client_first_name?: string;
  client_last_name?: string;
  client_phone?: string;
  package_name?: string;
  sessions_total?: number;
  price_paid?: number;
  start_date?: string;
  end_date?: string;
  invoice_number?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  // Authentication — must be a logged-in gym manager
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to your .env.local file." },
      { status: 500 }
    );
  }

  let fileBase64: string;
  let mediaType: string;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Server-side file size enforcement (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 413 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, or PDF." },
        { status: 400 }
      );
    }

    // PDFs are not directly supported by Claude Vision — convert to a message asking for text extraction
    if (file.type === "application/pdf") {
      // For PDFs, we try reading as base64 and using document type
      const bytes = await file.arrayBuffer();
      fileBase64 = Buffer.from(bytes).toString("base64");
      mediaType = "application/pdf";
    } else {
      const bytes = await file.arrayBuffer();
      fileBase64 = Buffer.from(bytes).toString("base64");
      mediaType = file.type;
    }
  } catch {
    return NextResponse.json({ error: "Failed to read file." }, { status: 400 });
  }

  const prompt = `You are a data extraction assistant for a gym's Personal Training (PT) billing system.

Extract the following fields from this PT membership bill or receipt:
- client_first_name: First name only of the PT client (string, no titles like "Dr." or "Mr.")
- client_last_name: Last name / family name of the PT client (string, can be empty string if only one name given)
- client_phone: Phone/mobile number of the client (string, digits only, no spaces or dashes)
- package_name: Name/description of the PT package (e.g., "1 Month PT - 3 days/week", "Gold Package")
- sessions_total: Total number of PT sessions included (integer)
- price_paid: Total amount paid in rupees (number, no currency symbol)
- start_date: Package start date in YYYY-MM-DD format (string)
- end_date: Package end date in YYYY-MM-DD format (string)
- invoice_number: Invoice/receipt number (string)
- notes: Any other relevant notes (string, optional)

Rules:
- For client_first_name: extract only the given name (e.g. "Rahul" from "Rahul Sharma", "Priya" from "Dr. Priya Patel")
- For client_last_name: extract only the family/surname (e.g. "Sharma", "Patel"), leave empty string "" if not present
- Do NOT include honorifics (Dr., Mr., Mrs., Ms.) in either name field

Return ONLY valid JSON with these exact field names. Use null for any field you cannot extract.
Do not include any explanation, markdown, or text outside the JSON.

Example response:
{"client_first_name":"Rahul","client_last_name":"Sharma","client_phone":"9876543210","package_name":"3 Month PT Package","sessions_total":36,"price_paid":15000,"start_date":"2024-01-01","end_date":"2024-03-31","invoice_number":"INV-2024-001","notes":null}`;

  try {
    const isPdf = mediaType === "application/pdf";
    const contentBlock = isPdf
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: fileBase64,
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: fileBase64,
          },
        };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Enable PDF support
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-opus-5-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [contentBlock, { type: "text", text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json(
        { error: "AI extraction failed. Check your API key and try again." },
        { status: 500 }
      );
    }

    const result = await response.json();
    const text = result.content?.[0]?.text ?? "";

    // Parse JSON from response
    let extracted: ExtractedBillData;
    try {
      // Handle potential markdown code fences
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      // If parsing fails, return empty extraction with a note
      return NextResponse.json({
        data: {} as ExtractedBillData,
        warning: "Could not parse bill automatically. Please fill in the details manually.",
      });
    }

    return NextResponse.json({ data: extracted });
  } catch (e: any) {
    console.error("Extract bill error:", e);
    return NextResponse.json(
      { error: e.message ?? "Extraction failed." },
      { status: 500 }
    );
  }
}
