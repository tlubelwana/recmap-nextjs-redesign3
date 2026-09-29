import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { setUserPersonas, type Persona } from "@/lib/db";
import { AUDIENCE_ORDER, isPersona } from "@/lib/audienceLens";

export const runtime = "nodejs";

/** Validated against the single audience registry in lib/audienceLens.ts,
 *  so a new audience cannot be added to the UI and silently rejected here. */
const VALID_PERSONAS: Persona[] = AUDIENCE_ORDER;

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { persona?: string; personas?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const personas = Array.isArray(body.personas) ? body.personas.filter(isPersona) : body.persona && isPersona(body.persona) ? [body.persona] : [];
  if (personas.length === 0 || personas.length !== (body.personas?.length ?? personas.length)) {
    return NextResponse.json({ error: "persona must be one of: " + VALID_PERSONAS.join(", ") }, { status: 400 });
  }

  setUserPersonas(user.id, personas);
  return NextResponse.json({ persona: personas[0], personas });
}
