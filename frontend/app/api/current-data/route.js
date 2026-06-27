import { NextResponse } from "next/server";
import path from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

const CURRENT_DATA_DIR = path.join(process.cwd(), "current-data");
const SUMMARY_FILE = path.join(CURRENT_DATA_DIR, "organization-summary.json");
const DEPARTMENT_ID_PATTERN = /^[a-z0-9-]+$/;

const ensureDataDir = async () => {
  await mkdir(CURRENT_DATA_DIR, { recursive: true });
};

const readJsonFile = async (filePath) => {
  try {
    const file = await readFile(filePath, "utf8");
    return JSON.parse(file);
  } catch {
    return null;
  }
};

const writeJsonFile = async (filePath, data) => {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const readDepartmentFiles = async () => {
  await ensureDataDir();
  const entries = await readdir(CURRENT_DATA_DIR, { withFileTypes: true });
  const departmentFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "organization-summary.json"
  );
  const departmentPairs = await Promise.all(
    departmentFiles.map(async (entry) => {
      const departmentId = entry.name.replace(/\.json$/, "");
      const data = await readJsonFile(path.join(CURRENT_DATA_DIR, entry.name));
      return data ? [departmentId, data] : null;
    })
  );

  return Object.fromEntries(departmentPairs.filter(Boolean));
};

const buildOrganizationSummary = (departments) => {
  const departmentSummaries = Object.values(departments)
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName))
    .map((department) => ({
      departmentId: department.departmentId,
      departmentName: department.departmentName,
      filename: department.filename,
      uploadedAt: department.uploadedAt,
      headers: department.headers,
      recordCount: department.recordCount,
      sampleRecords: department.sampleRecords,
    }));

  return {
    updatedAt: new Date().toISOString(),
    totalDepartments: departmentSummaries.length,
    totalRecords: departmentSummaries.reduce((sum, department) => sum + department.recordCount, 0),
    departments,
    departmentSummaries,
  };
};

const readOrganizationSummary = async () => {
  const departments = await readDepartmentFiles();
  const summary = buildOrganizationSummary(departments);
  await writeJsonFile(SUMMARY_FILE, summary);
  return summary;
};

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

    await ensureDataDir();
    const departmentFile = path.join(CURRENT_DATA_DIR, `${departmentId}.json`);
    await writeJsonFile(departmentFile, departmentSnapshot);

    const summary = await readOrganizationSummary();
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update current data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
