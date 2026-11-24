import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import compression from "compression";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Express Body Parser with elevated limits in case of complex configurations
app.use(express.json({ limit: "5mb" }));

// Health Check for Railway/PaaS monitoring
app.get("/api/health", (req, res) => {
  res.json({ status: "alive", brand: "Rune Projects" });
});

// Secure server-side Gemini client utility
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "rune-map-topology",
    },
  },
});

// AI Configuration Auditor Route
app.post("/api/audit-config", async (req, res) => {
  try {
    const { xmlString } = req.body;
    if (!xmlString) {
      return res.status(400).json({ error: "configuração XML não fornecida." });
    }

    const systemInstruction = `Você é um analista especialista em segurança de redes e administração pfSense.
Analise a configuração XML do pfSense fornecida pelo usuário.
Gere uma lista estruturada de auditoria cobrindo vulnerabilidades de segurança, melhores práticas de topologia IPsec/VPN, parametrização DHCP, redundâncias (Gateways Groups), portas abertas inseguras (como SSH na porta padrão) ou qualquer inadequação técnica.
A resposta deve ser em português bem estruturado. Avalie a segurança geral e emita um score final coerente de 0 a 100.
Importante: Seja extremamente específico no pfSense (ex: "Phase 1 IPsec com algoritmos antigos", "SSH acessível em porta padrão 22", "DHCP Range sobreposto").`;

    let auditData;

    // Logic to switch between Ollama and Gemini
    if (process.env.OLLAMA_URL) {
      const ollamaUrl = process.env.OLLAMA_URL.replace(/\/$/, '');
      const model = process.env.OLLAMA_MODEL || 'llama3';
      
      const prompt = `${systemInstruction}\n\nXML pfSense para Auditoria:\n\n${xmlString}\n\nResponda APENAS em JSON seguindo este esquema: { "score": 100, "summary": "texto", "audits": [ { "severity": "high/medium/info", "category": "...", "title": "...", "description": "...", "recommendation": "..." } ] }`;

      try {
        const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
            format: 'json'
          })
        });

        if (!ollamaResponse.ok) throw new Error(`Ollama error: ${ollamaResponse.statusText}`);
        const ollamaJson: any = await ollamaResponse.json();
        auditData = JSON.parse(ollamaJson.response);
      } catch (ollamaErr: any) {
        console.error("Ollama fallback failed:", ollamaErr);
        throw new Error(`Erro ao conectar com o Ollama: ${ollamaErr.message}`);
      }
    } else {
      // Original Gemini Logic
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `XML pfSense para Auditoria:\n\n${xmlString}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { 
                type: Type.INTEGER, 
                description: "Indique uma nota geral de segurança e aderência a boas práticas, de 0 (crítico) a 100 (excelente)." 
              },
              summary: {
                type: Type.STRING,
                description: "Breve resumo geral sobre a robustez e estado da configuração apresentada."
              },
              audits: {
                type: Type.ARRAY,
                description: "Array de ocorrências encontradas.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { 
                      type: Type.STRING, 
                      description: "Gravidade do item. Deve ser estritamente 'high', 'medium' ou 'info'." 
                    },
                    category: { 
                      type: Type.STRING, 
                      description: "Segmento do problema, ex: 'Segurança', 'Rede', 'Serviços', 'VPN', 'DHCP'." 
                    },
                    title: { 
                      type: Type.STRING, 
                      description: "Título curto e claro em português." 
                    },
                    description: { 
                      type: Type.STRING, 
                      description: "Detalhamento explicativo em português de onde está a fragilidade." 
                    },
                    recommendation: { 
                      type: Type.STRING, 
                      description: "Instrução específica de como solucionar o problema no menu do pfSense." 
                    }
                  },
                  required: ["severity", "category", "title", "description", "recommendation"]
                }
              }
            },
            required: ["score", "summary", "audits"]
          }
        }
      });
      const resultText = response.text || "{}";
      auditData = JSON.parse(resultText);
    }

    return res.json(auditData);
  } catch (error: any) {
    console.error("Gemini Audit Endpoint Error:", error);
    
    let errorMessage = "Ocorreu um erro ao auditar a configuração.";
    
    // Improved detection of High Demand / 503 errors
    const isHighDemand = error?.status === 503 || 
                        error?.message?.includes("503") || 
                        error?.message?.includes("high demand") ||
                        (error?.response?.status === 503);

    if (isHighDemand) {
      errorMessage = "A inteligência artificial está com alta demanda no momento (503). Por favor, aguarde alguns instantes e tente novamente.";
    } else if (error?.message) {
      // Clean up the error message if it's a known API error
      errorMessage = `Erro no Assistente: ${error.message.replace(/ApiError: /, '')}`;
    }

    return res.status(500).json({ error: errorMessage });
  }
});

// Configure Vite middleware or static serving
async function bootstrap() {
  // Use compression middleware to shrink static JS/CSS transfers (reduces memory & bandwidth)
  app.use(compression());

  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(distPath);
  
  // Auto-detect isRailway or similar cloud platform to avoid starting dynamic bundlers
  const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined || process.env.RAILWAY_STATIC_URL !== undefined;
  const forceProd = process.env.NODE_ENV === "production" || isRailway || (hasDist && process.env.NODE_ENV !== "development");

  if (!forceProd) {
    console.log("Iniciando em ambiente de desenvolvimento com Vite Dev Server...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Carregando servidor de produção (Local-First Static Mode)...");
    if (!hasDist) {
      console.warn("ALERTA: A pasta 'dist' não existe! Executando em modo produção sem 'dist'.");
    }
    
    // Serve static files with custom cache control to reduce CPU overhead per request
    app.use(express.static(distPath, {
      maxAge: "1d",
      etag: true
    }));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running securely on port ${PORT}`);
  });
}

bootstrap();
