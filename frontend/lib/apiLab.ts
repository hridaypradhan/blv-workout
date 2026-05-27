import { Endpoint, RequestParameter } from "../types/apiLab";

export async function fetchOpenApiSchema(baseUrl: string): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, "")}/openapi.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch schema: ${res.statusText}`);
  }
  return res.json();
}

export function parseSchema(schema: unknown): Endpoint[] {
  if (!schema || typeof schema !== "object" || !("paths" in schema)) return [];

  const openapiObj = schema as { paths: Record<string, Record<string, unknown>> };
  const endpoints: Endpoint[] = [];

  for (const [path, pathItem] of Object.entries(openapiObj.paths)) {
    if (typeof pathItem !== "object" || pathItem === null) continue;

    for (const [method, operation] of Object.entries(pathItem)) {
      const lowerMethod = method.toLowerCase();
      if (!["get", "post", "put", "delete", "options", "head", "patch"].includes(lowerMethod)) {
        continue;
      }

      const op = operation as {
        parameters?: Array<{
          name: string;
          in: string;
          required?: boolean;
          schema?: { type?: string };
          description?: string;
        }>;
        tags?: string[];
        summary?: string;
        description?: string;
        requestBody?: unknown;
      };
      const parameters: RequestParameter[] = [];

      // Parse operation-specific parameters
      if (Array.isArray(op.parameters)) {
        for (const p of op.parameters) {
          if (p.in === "path" || p.in === "query" || p.in === "header") {
            parameters.push({
              name: p.name,
              in: p.in as "path" | "query" | "header",
              required: p.required || false,
              type: p.schema?.type || "string",
              description: p.description || "",
              value: ""
            });
          }
        }
      }

      // Parse path-level parameters if any
      const pathItemObj = pathItem as {
        parameters?: Array<{
          name: string;
          in: string;
          required?: boolean;
          schema?: { type?: string };
          description?: string;
        }>;
      };
      if (Array.isArray(pathItemObj.parameters)) {
        for (const p of pathItemObj.parameters) {
          if (!parameters.some((existing) => existing.name === p.name && existing.in === p.in)) {
            if (p.in === "path" || p.in === "query" || p.in === "header") {
              parameters.push({
                name: p.name,
                in: p.in as "path" | "query" | "header",
                required: p.required || false,
                type: p.schema?.type || "string",
                description: p.description || "",
                value: ""
              });
            }
          }
        }
      }

      endpoints.push({
        path,
        method: method.toUpperCase(),
        tags: op.tags || ["default"],
        summary: op.summary || "",
        description: op.description || "",
        parameters,
        requestBodySchema: op.requestBody
      });
    }
  }

  // Inject health check route if not declared in FastAPI schema paths, or ensure it's mapped cleanly
  if (!endpoints.some((e) => e.path === "/health")) {
    endpoints.unshift({
      path: "/health",
      method: "GET",
      tags: ["health"],
      summary: "System health check",
      description: "Return backend health status",
      parameters: []
    });
  }

  return endpoints;
}
