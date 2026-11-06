const targets = {
  temperatura:
    "http://[2600:1f18:4915:2d01:3c9b:782f:83d1:34e9]:5000/api/temperatura/1",

  presion:
    "http://[2600:1f18:4915:2d01:3c9b:782f:83d1:34e9]:5000/api/presion-neumaticos/1",

  combustible:
    "http://[2600:1f18:4915:2d01:3c9b:782f:83d1:34e9]:5000/api/combustible/1",

  transmision:
    "http://[2600:1f18:7218:0:8be9:ffdb:bd0f:a2e9]:8000/api/transmision/1",

  frenos:
    "http://[2600:1f18:7218:0:8be9:ffdb:bd0f:a2e9]:8000/api/frenos/1",

  motor:
    "http://[2600:1f18:7218:0:8be9:ffdb:bd0f:a2e9]:8000/api/estado-motor/1"
};

module.exports = async (req, res) => {
  const resultados = {};

  await Promise.all(
    Object.entries(targets).map(async ([sensor, url]) => {
      const inicio = Date.now();

      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000)
        });

        const body = await response.text();

        resultados[sensor] = {
          conectado: response.ok,
          status: response.status,
          tiempo_ms: Date.now() - inicio,
          respuesta: body.slice(0, 500)
        };
      } catch (error) {
        resultados[sensor] = {
          conectado: false,
          tiempo_ms: Date.now() - inicio,
          error: error.message,
          causa: error.cause?.code || null
        };
      }
    })
  );

  res.status(200).json({
    mensaje: "Diagnóstico de conectividad IPv6 desde Vercel",
    resultados
  });
};