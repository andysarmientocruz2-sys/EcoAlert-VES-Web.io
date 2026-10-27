import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
export const GEMINI_READY = !!apiKey;

const genAI = GEMINI_READY ? new GoogleGenerativeAI(apiKey!) : null;

export interface GeminiReportAnalysis {
  confidence: number;       // 0-100
  severity: "bajo" | "medio" | "alto";
  severityLabel: string;
  priority: "Baja" | "Normal" | "Alta" | "Urgente";
  areaEstimate: string;
  sanitaryRisk: string;
  description: string;      // AI-generated description of what it sees
  recommendations: string[];
  contaminantType: string;
}

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export async function analyzeReportWithGemini(
  imageBase64: string | null,
  reportType: string,
  userDescription: string,
  location: string
): Promise<GeminiReportAnalysis | null> {
  if (!genAI) return null;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings: SAFETY });

  const typeNames: Record<string, string> = {
    basura: "acumulación de basura/residuos sólidos",
    quema: "quema de residuos o vegetación",
    aguas: "contaminación de aguas o efluentes",
    escombros: "vertido de escombros o desmonte",
    aire: "contaminación del aire o emisiones",
    otros: "contaminación ambiental general",
  };
  const typeName = typeNames[reportType] || "contaminación ambiental";

  const prompt = `Eres un experto en evaluación ambiental para la Municipalidad de Villa El Salvador, Lima, Perú.

Analiza este reporte ciudadano de ${typeName}:
- Descripción del usuario: "${userDescription}"
- Ubicación: "${location}"
- Tipo de contaminación reportado: ${typeName}

${imageBase64 ? "Se adjunta imagen del problema." : "No se adjuntó imagen, basa el análisis en la descripción."}

Responde ÚNICAMENTE en este formato JSON exacto, sin texto adicional:
{
  "confidence": <número 70-99>,
  "severity": "<bajo|medio|alto>",
  "severityLabel": "<Bajo|Medio|Alto>",
  "priority": "<Baja|Normal|Alta|Urgente>",
  "areaEstimate": "<estimación del área afectada>",
  "sanitaryRisk": "<Bajo|Medio|Medio-Alto|Alto|Muy Alto>",
  "description": "<descripción técnica breve de 1-2 oraciones de lo observado>",
  "contaminantType": "<tipo específico de contaminante>",
  "recommendations": [
    "<recomendación 1 específica para VES>",
    "<recomendación 2>",
    "<recomendación 3>",
    "<recomendación 4>"
  ]
}`;

  try {
    const parts: any[] = [{ text: prompt }];

    if (imageBase64 && imageBase64.startsWith("data:")) {
      const [header, data] = imageBase64.split(",");
      const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
      parts.push({ inlineData: { mimeType, data } });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as GeminiReportAnalysis;
  } catch {
    return null;
  }
}
