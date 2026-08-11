var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new import_genai.GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: /* @__PURE__ */ new Date() });
});
app.post("/api/gemini/parse-tree", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0\u6587\u672C\u3002" });
  }
  const ai = getGeminiClient();
  if (!ai) {
    console.log("Using simulated parser fallback (no API key configured).");
    return res.json({
      simulated: true,
      name: "AI \u5BFC\u5165: \u62DF\u6295\u9879\u76EE\u51B3\u7B56\u6811",
      description: "\u6839\u636E\u63D0\u4F9B\u7684\u6587\u672C\uFF0CAI \u81EA\u52A8\u62BD\u53D6\u7684\u4E24\u9636\u6BB5\u6295\u8D44\u65B9\u6848\u62D3\u6251\u3002",
      nodes: [
        { id: "root", name: "\u62DF\u6295\u9879\u76EE\u6218\u7565\u8DEF\u7EBF", type: "DECISION", parentId: null },
        { id: "project_alpha", name: "\u65B9\u68481: \u53C2\u80A1\u963F\u5C14\u6CD5\u9879\u76EE", type: "CHANCE", parentId: "root", cost: 100 },
        { id: "alpha_high", name: "\u9AD8\u7206\u53D1\u6536\u76CA (70%)", type: "TERMINAL", parentId: "project_alpha", probability: 0.7, payoff: 400 },
        { id: "alpha_low", name: "\u4F4E\u7206\u53D1\u635F\u76CA (30%)", type: "TERMINAL", parentId: "project_alpha", probability: 0.3, payoff: -20 },
        { id: "project_beta", name: "\u65B9\u68482: \u5168\u8D44\u6536\u8D2D\u8D1D\u5854\u9879\u76EE", type: "CHANCE", parentId: "root", cost: 250 },
        { id: "beta_high", name: "\u9AD8\u5E02\u573A\u63A5\u53D7 (50%)", type: "TERMINAL", parentId: "project_beta", probability: 0.5, payoff: 600 },
        { id: "beta_low", name: "\u4F4E\u5E02\u573A\u63A5\u53D7 (50%)", type: "TERMINAL", parentId: "project_beta", probability: 0.5, payoff: 50 },
        { id: "project_fixed", name: "\u65B9\u68483: \u56FD\u503A\u7406\u8D22\u76F4\u63A5\u83B7\u76CA", type: "TERMINAL", parentId: "root", payoff: 60 }
      ]
    });
  }
  try {
    const prompt = `\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u8FD0\u7B79\u5B66\u51B3\u7B56\u5206\u6790\u4E13\u5BB6\u3002\u73B0\u5728\u8BF7\u9605\u8BFB\u4E0B\u9762\u7684\u51B3\u7B56\u60C5\u666F\u63CF\u8FF0\uFF0C\u5E76\u5C06\u5176\u5B8C\u6574\u3001\u7CBE\u786E\u5730\u63D0\u70BC\u6210\u4E00\u4E2A\u201C\u51B3\u7B56\u6811\u62D3\u6251\u6570\u636E\u201D\u3002

\u8BF7\u9075\u5B88\u4EE5\u4E0B\u5EFA\u6A21\u51C6\u5219\uFF1A
1. \u6700\u9876\u5C42\u6839\u8282\u70B9\u7684 id \u5FC5\u987B\u662F "root"\u3002\u6240\u6709\u51B3\u7B56\u8282\u70B9\u548C\u673A\u4F1A\u8282\u70B9\u5728\u5F80\u4E0B\u6D41\u52A8\u65F6\u90FD\u8981\u6709\u660E\u786E\u7684 parentId \u5173\u8054\u3002
2. \u4E25\u683C\u533A\u5206\u4EE5\u4E0B\u4E09\u79CD\u8282\u70B9\u7C7B\u578B (type)\uFF1A
   - "DECISION": \u51B3\u7B56\u8282\u70B9\uFF08\u8868\u793A\u51B3\u7B56\u8005\u9700\u8981\u4E3B\u52A8\u505A\u51FA\u9009\u62E9\u7684\u5206\u53C9\u53E3\uFF0C\u4F8B\u5982\uFF1A\u7814\u53D1 vs \u4E0D\u7814\u53D1\uFF09\u3002
   - "CHANCE": \u673A\u4F1A\u8282\u70B9\uFF08\u8868\u793A\u5B58\u5728\u968F\u673A\u4E0D\u786E\u5B9A\u6027\u7684\u72B6\u6001\u5206\u53C9\u53E3\uFF0C\u5176\u6240\u6709\u5B50\u5206\u53C9\u9879\u5FC5\u987B\u6709 probability \u6982\u7387\uFF09\u3002
   - "TERMINAL": \u6700\u7EC8\u7ED3\u5C40\u8282\u70B9\uFF08\u8868\u793A\u4E0D\u518D\u7EE7\u7EED\u5F80\u4E0B\u5206\u53C9\uFF0C\u800C\u662F\u6709\u5177\u4F53 payoffs \u635F\u76CA\u503C\uFF0C\u6BD4\u5982\u51C0\u8D5A\u6216\u51C0\u4E8F\uFF09\u3002
3. \u53C2\u6570\u63D0\u53D6\u4E0E\u5F52\u4E00\u5316\uFF1A
   - \u63D0\u53D6\u5404\u5904\u7684\u201C\u6982\u7387 (probability)\u201D, \u6216\u8005\u662F\u201C\u7ED3\u5C40\u635F\u76CA (payoff)\u201D\uFF0C\u4EE5\u53CA\u9009\u62E9\u67D0\u4E2A\u5206\u652F\u9700\u8981\u989D\u5916\u4ED8\u51FA\u7684\u201C\u6210\u672C\u8D39\u7528 (cost)\u201D\u3002
   - \u5C06\u6570\u503C\u5355\u4F4D\u5F52\u4E00\u5316\uFF08\u5982\u6587\u4E2D\u63D0\u5230 200\u4E07\u3001\u4E8F50\u4E07\uFF0C\u4F60\u53EF\u4EE5\u5168\u90E8\u6362\u7B97\u4E3A\u4EE5\u201C\u4E07\u5143\u201D\u4E3A\u5355\u4F4D\u7684\u6570\u5B57\uFF0C\u4F8B\u5982 200\u4E07 -> 200\uFF0C\u4E8F50\u4E07 -> -50\uFF09\uFF0C\u786E\u4FDD\u6574\u4E2A\u51B3\u7B56\u6811\u7684 payoff \u5904\u4E8E\u540C\u4E00\u6BD4\u4F8B\u5C3A\u4E0B\u3002
   - \u786E\u4FDD\u540C\u4E00\u4E2A CHANCE \u8282\u70B9\u4E0B\u7684\u5404\u5B50\u8282\u70B9\u6982\u7387\u4E4B\u548C\u5E94\u8BE5\u7B49\u4E8E 1.0 (\u5982\u679C\u6587\u4E2D\u6709\u5FAE\u5C0F\u504F\u5DEE\u8BF7\u81EA\u52A8\u5FAE\u8C03\u4FDD\u8BC1\u6570\u5B66\u4E0A\u7684\u4E25\u8C28\u6027)\u3002

\u60C5\u666F\u63CF\u8FF0\u6587\u672C\u4E3A\uFF1A
${text}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          required: ["name", "description", "nodes"],
          properties: {
            name: { type: import_genai.Type.STRING, description: "\u4E3A\u6B64\u6A21\u578B\u53D6\u4E00\u4E2A\u4E13\u4E1A\u7684\u51B3\u7B56\u4E3B\u9898\u540D" },
            description: { type: import_genai.Type.STRING, description: "\u6839\u636E\u60C5\u8282\u81EA\u52A8\u603B\u7ED3\u7684\u7CBE\u70BC\u4E1A\u52A1\u80CC\u666F\u548C\u76EE\u6807" },
            nodes: {
              type: import_genai.Type.ARRAY,
              description: "\u51B3\u7B56\u6811\u8282\u70B9\u5217\u8868",
              items: {
                type: import_genai.Type.OBJECT,
                required: ["id", "name", "type"],
                properties: {
                  id: { type: import_genai.Type.STRING, description: "\u552F\u4E00\u8282\u70B9ID (\u5982 root, option_a, outcome_high \u7B49)" },
                  name: { type: import_genai.Type.STRING, description: "\u8282\u70B9\u6216\u5206\u652F\u540D\u79F0" },
                  type: { type: import_genai.Type.STRING, description: "DECISION, CHANCE, \u6216\u8005\u662F TERMINAL" },
                  parentId: { type: import_genai.Type.STRING, description: "\u7236\u8282\u70B9ID (\u6700\u5F00\u59CB\u7684\u5B50\u8282\u70B9\u6307\u5411 root)" },
                  probability: { type: import_genai.Type.NUMBER, description: "\u6982\u7387\u503C\uFF080-1\uFF09\uFF0C\u5982\u679C\u7236\u8282\u70B9\u662F CHANCE \u5219\u5FC5\u586B" },
                  payoff: { type: import_genai.Type.NUMBER, description: "\u7ED3\u5C40\u65F6\u7684\u635F\u76CA\uFF08\u6B63\u8868\u793A\u6536\u76CA\uFF0C\u8D1F\u8868\u793A\u4E8F\u635F\uFF09\uFF0C\u5982\u679C type \u4E3A TERMINAL \u5219\u5FC5\u586B" },
                  cost: { type: import_genai.Type.NUMBER, description: "\u6B64\u51B3\u7B56\u6216\u8DEF\u5F84\u7684\u9009\u62E9\u6210\u672C\uFF0C\u5982\u7814\u53D1\u6210\u672C\uFF0C\u5C5E\u4E8E\u652F\u51FA\uFF0C\u975E\u5FC5\u586B" }
                }
              }
            }
          }
        }
      }
    });
    const parsedData = JSON.parse(response.text.trim());
    res.json(parsedData);
  } catch (error) {
    console.error("Gemini parse failed:", error);
    res.status(500).json({ error: "AI \u8BED\u4E49\u89E3\u6790\u5931\u8D25\uFF1A" + (error.message || error) });
  }
});
app.post("/api/gemini/recommend", async (req, res) => {
  const { tree, solvedNodes } = req.body;
  if (!tree || !solvedNodes) {
    return res.status(400).json({ error: "\u7F3A\u5931\u51B3\u7B56\u6811\u7ED3\u6784\u53CA\u6C42\u89E3\u7ED3\u679C\u3002" });
  }
  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      simulated: true,
      analysis: `### \u{1F4A1} AI \u667A\u6167\u51B3\u7B56\u900F\u89C6 (\u6F14\u793A\u6A21\u5F0F)

\u901A\u8FC7 **\u9006\u5411\u5F52\u7EB3\u6CD5 (Backward Induction)** \u5BF9\u5F53\u524D\u6A21\u578B\u8FDB\u884C\u6574\u4F53\u8BC4\u4F30\uFF0C\u6211\u4EEC\u5F97\u51FA\u4EE5\u4E0B\u5173\u952E\u6D1E\u5BDF\uFF1A

1. **\u6838\u5FC3\u63A8\u6F14\u8DEF\u5F84\uFF1A** 
   \u82E5\u5F53\u524D\u9009\u7528\u201C\u667A\u80FDIoT\u82AF\u7247\u6218\u7565\u9009\u62E9\u201D\u7684\u4F18\u80DC\u7B56\u7565\uFF0C\u5E94\u9996\u9009 **\u8DEF\u5F84A: \u81EA\u4E3B\u72EC\u7ACB\u7814\u53D1** (\u7814\u53D1\u521D\u671F\u6295\u5165 \xA5450k)\u3002
   - \u5176\u4E0B\u5C5E\u5206\u652F\u201C\u7814\u53D1\u6210\u529F\u201D\u6982\u7387\u9AD8\u8FBE 70%\uFF0C\u5728\u6210\u529F\u540E\u8FDB\u5165\u201C\u8425\u9500\u9636\u6BB5\u201D\uFF0C**\u51B3\u7B56A2: \u7CBE\u76CA\u5F0F\u4F17\u7B79\u5B9A\u5236** \u63D0\u4F9B\u7684\u671F\u671B\u4EF7\u503C\uFF08EMV\uFF09\u6BD4\u6FC0\u8FDB\u6E20\u9053\u5927\uFF0C\u63D0\u4F9B\u4E86\u66F4\u7A33\u5065\u7684\u907F\u9669\u533A\u95F4\u3002
   
2. **\u98CE\u9669\u5256\u9762\u7279\u5F81\uFF1A**
   - **\u6700\u4F18EMV\uFF1A** \u6574\u4F53\u671F\u671B\u53D7\u76CA\u8D85\u8FC7\u6280\u672F\u76F4\u63A5\u6388\u6743\u3002
   - **\u4E0B\u884C\u6781\u7AEF\u98CE\u9669\uFF1A** \u81EA\u4E3B\u7814\u53D1\u6709 30% \u5206\u652F\u4EE5\u4E8F\u635F\u7ED3\u675F\uFF0C\u82E5\u5BF9\u73B0\u91D1\u6D41\u6781\u5176\u654F\u611F\uFF0C\u5EFA\u8BAE\u7ED3\u5408**\u6280\u672F\u6388\u6743** (\u62E5\u6709 \xA5450k-$500k \u7684\u6E05\u8D27\u4FDD\u969C\u7A7A\u95F4) \u8FDB\u884C\u4E24\u624B\u51C6\u5907\u3002

3. **\u654F\u611F\u51B3\u7B56\u4E34\u754C\uFF1A**
   - \u5173\u6CE8**\u7814\u53D1\u6210\u529F\u7387**\u3002\u5982\u679C\u6210\u529F\u7387\u4E0B\u964D\u81F3 55% \u4EE5\u4E0B\uFF0C\u5219\u6574\u4F53\u6700\u4F18\u5929\u5E73\u5C06\u8F6C\u5411\u201C\u8DEF\u5F84B: \u8D2D\u4E70\u5916\u90E8\u6280\u672F\u6388\u6743\u201D\u3002\u516C\u53F8\u9700\u9488\u5BF9\u6B64 15% \u7684\u504F\u79BB\u5B89\u5168\u57AB\u5EFA\u7ACB\u5B9E\u65F6\u7684\u9884\u8B66\u76D1\u63A7\u6307\u6807\u3002`
    });
  }
  try {
    const prompt = `\u60A8\u662F\u9876\u5C16\u7684\u8FD0\u7B79\u5B66\u9AD8\u7EA7\u5546\u4E1A\u51B3\u7B56\u987E\u95EE\u3002\u6B63\u5728\u901A\u8FC7\u51B3\u7B56\u6811\uFF08EMV \u9006\u5411\u5F52\u7EB3\u6CD5\uFF09\u5E2E\u52A9\u4F01\u4E1A\u5206\u6790\u6295\u8D44\u9879\u76EE\u3002
\u8BF7\u57FA\u4E8E\u4E0B\u65B9\u63D0\u4F9B\u7684\u201C\u51B3\u7B56\u6811\u7ED3\u6784 (Tree)\u201D\u548C\u201CEMV\u6C42\u89E3\u540E\u72B6\u6001 (Solved Nodes)\u201D\u7ED9\u51FA\u4E13\u4E1A\u7684\u6C47\u62A5\u7EA7\u54A8\u8BE2\u62A5\u544A\u3002

\u51B3\u7B56\u6811\u540D\u4E3A: ${tree.name}
\u8BF4\u660E: ${tree.description}

\u6570\u636E\u8BB0\u5F55:
${JSON.stringify({ nodes: solvedNodes }, null, 2)}

\u8BF7\u64B0\u5199\u4E00\u4EFD\u4E2D\u6587\u5206\u6790\u62A5\u544A\uFF0C\u5FC5\u987B\u6392\u7248\u5927\u65B9\u4E14\u5BCC\u6709\u56FE\u8868\u5316\u7684\u611F\u89C9\uFF08\u63A8\u8350\u4F7F\u7528 Markdown \u7F16\u5199\uFF0C\u5305\u62EC Emoji\uFF09\uFF0C\u5305\u542B\u4EE5\u4E0B\u7AE0\u8282\uFF1A
1. **\u{1F3C6} \u9EC4\u91D1\u51B3\u7B56\u8DEF\u5F84\u8BF4\u660E**\uFF1A\u660E\u786E\u6307\u51FA\u5E94\u8BE5\u9009\u53D6\u7684\u6700\u4F73\u6B65\u9AA4\u8DEF\u5F84\u5206\u652F\uFF0C\u5B83\u80FD\u5E26\u6765\u7684\u9884\u671F\u8D27\u5E01\u6536\u76CA\uFF08EMV\uFF09\u662F\u591A\u5C11\uFF0C\u4EE5\u53CA\u4E3A\u4EC0\u4E48\u8BE5\u8DEF\u5F84\u6BD4\u5176\u4ED6\u88AB\u526A\u679D\u6389\uFF08isPruned=true\uFF09\u7684\u65B9\u6848\u66F4\u4F18\u8D8A\u3002
2. **\u{1F4C8} \u98CE\u9669\u66B4\u9732\u4E0E\u4E0B\u884C\u9884\u8B66**\uFF1A\u4ECE\u6982\u7387\u548C\u7ED3\u5C40\uFF08Terminal\uFF09\u6765\u770B\uFF0C\u8BE5\u6700\u4F73\u7B56\u7565\u53EF\u80FD\u4F1A\u9762\u4E34\u7684\u201C\u6700\u5DEE\u7ED3\u5C40\u201D\u548C\u6982\u7387\u662F\u591A\u5C11\uFF1F\u5982\u4F55\u5EFA\u7ACB\u98CE\u63A7\u5236\u5EA6\uFF1F
3. **\u{1F527} \u654F\u611F\u53C2\u6570\u98CE\u63A7\u4E34\u754C\u70B9**\uFF1A\u5217\u4E3E\u54EA\u4E9B\u53C2\u6570\u6CE2\u52A8\uFF08\u5982\u7814\u53D1\u6210\u529F\u7387\u3001\u5E02\u573A\u66B4\u8DCC\u6982\u7387\u3001\u6E20\u9053\u6210\u672C\u7B49\uFF09\u4F1A\u6700\u5BB9\u6613\u6539\u53D8\u5F53\u524D\u6700\u4F18\u89E3\uFF0C\u7ED9\u51FA\u5B9A\u91CF\u7684\u6218\u7565\u907F\u9669\u5EFA\u8BAE\u3002

\u5B57\u6570\u5728 500-800 \u5B57\u5DE6\u53F3\uFF0C\u8BED\u8A00\u8981\u8C26\u900A\u3001\u4E13\u4E1A\u800C\u6709\u529B\uFF0C\u907F\u514D\u5927\u6BB5\u67AF\u71E5\u7684\u957F\u6587\uFF0C\u591A\u7528\u6761\u4E3E\u3002`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });
    res.json({ analysis: response.text });
  } catch (error) {
    console.error("Gemini recommendation failed:", error);
    res.status(500).json({ error: "AI \u667A\u80FD\u51B3\u7B56\u5931\u8D25\uFF1A" + (error.message || error) });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Operations Research App listening on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
