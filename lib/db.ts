import { Pool } from "pg";

let pool: Pool | undefined;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return databaseUrl;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl()
    });
  }

  return pool;
}

export async function query<T>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}

export async function sql(
  strings: TemplateStringsArray,
  ...values: Array<string | number | boolean | null>
) {
  const text = strings.reduce((accumulator, part, index) => {
    const value = index < values.length ? `$${index + 1}` : "";
    return `${accumulator}${part}${value}`;
  }, "");

  return query(text, values);
}

