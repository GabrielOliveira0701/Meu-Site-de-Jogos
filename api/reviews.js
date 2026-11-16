const MAX_COMMENT_LENGTH = 500;
const MAX_AUTHOR_LENGTH = 30;

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    url: supabaseUrl.replace(/\/+$/, ""),
    anonKey: supabaseAnonKey
  };
}

module.exports = async function handler(req, res) {
  const config = getSupabaseConfig();

  if (!config) {
    return sendJson(res, 503, {
      error: "As avaliações ainda não foram configuradas no servidor."
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Método não permitido." });
  }

  let gameId;
  let payload;

  if (req.method === "GET") {
    gameId = Number(req.query && req.query.game_id);
  } else {
    try {
      payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return sendJson(res, 400, { error: "O conteúdo enviado não é um JSON válido." });
    }

    gameId = Number(payload && payload.game_id);
  }

  if (!Number.isSafeInteger(gameId) || gameId < 1) {
    return sendJson(res, 400, { error: "Identificador de jogo inválido." });
  }

  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`
  };

  let url = `${config.url}/rest/v1/game_reviews?select=id,game_id,rating,author_name,comment,created_at`;
  const request = { headers };

  if (req.method === "GET") {
    url += `&game_id=eq.${gameId}&order=created_at.desc&limit=100`;
  } else {
    const rating = Number(payload.rating);
    const authorName = typeof payload.author_name === "string"
      ? payload.author_name.trim() || "Visitante"
      : "Visitante";
    const comment = typeof payload.comment === "string" ? payload.comment.trim() : "";

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return sendJson(res, 400, { error: "Escolha uma nota entre 1 e 5 estrelas." });
    }

    if (authorName.length > MAX_AUTHOR_LENGTH) {
      return sendJson(res, 400, { error: "O apelido deve ter no máximo 30 caracteres." });
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
      return sendJson(res, 400, { error: "O comentário deve ter no máximo 500 caracteres." });
    }

    request.method = "POST";
    request.headers = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    };
    request.body = JSON.stringify({
      game_id: gameId,
      rating,
      author_name: authorName,
      comment
    });
  }

  try {
    const response = await fetch(url, request);
    const responseText = await response.text();

    if (!response.ok) {
      console.error("Supabase reviews request failed", { status: response.status });
      return sendJson(res, 502, {
        error: "O serviço de avaliações não conseguiu atender à solicitação."
      });
    }

    const result = responseText ? JSON.parse(responseText) : [];
    return sendJson(res, req.method === "GET" ? 200 : 201, {
      reviews: req.method === "GET" ? result : undefined,
      review: req.method === "POST" ? result[0] : undefined
    });
  } catch (error) {
    console.error("Unable to reach Supabase reviews service", error);
    return sendJson(res, 502, {
      error: "Não foi possível conectar ao serviço de avaliações."
    });
  }
};
