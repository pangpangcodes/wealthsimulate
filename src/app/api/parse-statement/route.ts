import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Determine if this is a PDF or an image
    const isPdf = file.type.includes('pdf');
    const imageMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
      file.type.includes('png') ? 'image/png' : 'image/jpeg';

    // Build the content block based on file type
    const fileBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam = isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }
      : {
          type: 'image',
          source: { type: 'base64', media_type: imageMediaType, data: base64 },
        };

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: `Parse this Wealthsimple investment statement and extract the financial data into this exact JSON structure. If you can't find a value, use null. Do NOT invent or estimate any numbers - only extract what's explicitly stated in the document.

Return ONLY valid JSON with this structure:
{
  "accounts": [
    {
      "name": "Account name from statement",
      "type": "rrsp" | "tfsa" | "fhsa" | "non-registered" | "resp",
      "marketValue": <number>,
      "holdings": [
        {
          "ticker": "TICKER",
          "name": "Full fund name",
          "marketValue": <number>,
          "assetClass": "canadian-equity" | "us-equity" | "international-equity" | "emerging-markets" | "canadian-bonds" | "international-bonds" | "high-yield-bonds" | "gold" | "cash" | "real-estate",
          "currency": "CAD" | "USD"
        }
      ]
    }
  ],
  "totalValue": <number>,
  "statementDate": "YYYY-MM-DD",
  "parseConfidence": "high" | "medium" | "low",
  "warnings": ["any issues or assumptions made"]
}`,
            },
          ],
        },
      ],
    });

    // Extract JSON from Claude's response
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'Failed to parse statement - no response from AI' },
        { status: 500 }
      );
    }

    // Try to extract JSON from the response
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(textBlock.text);
    } catch {
      // Try to find JSON in markdown code block
      const jsonMatch = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find JSON object directly
        const objMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (objMatch) {
          parsed = JSON.parse(objMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      rawResponse: textBlock.text,
    });
  } catch (error) {
    console.error('Parse statement error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI parsing error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to parse statement. Please try manual entry instead.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
