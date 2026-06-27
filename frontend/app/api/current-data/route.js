import { NextResponse } from "next/server";
import {
  readOrganizationSummary,
  upsertDepartmentSnapshot,
} from "@/lib/current-data-store";

const DEPARTMENT_ID_PATTERN = /^[a-z0-9-]+$/;

export async function GET() {
  try {
    const summary = await readOrganizationSummary();
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read current data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const departmentSnapshot = await request.json();
    const departmentId = departmentSnapshot?.departmentId;

    if (!departmentId || !DEPARTMENT_ID_PATTERN.test(departmentId)) {
      return NextResponse.json({ error: "Invalid department id." }, { status: 400 });
    }

    const summary = await upsertDepartmentSnapshot(departmentSnapshot);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update current data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
