import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_PATH = "./models/sedan-original.glb";

const API = {
  temperatura: "/proxy/temperatura/1",
  presion: "/proxy/presion-neumaticos/1",
  combustible: "/proxy/combustible/1",
  transmision: "/proxy/sensores/transmision/1",
  frenos: "/proxy/sensores/frenos/1",
  motor: "/proxy/sensores/motor/1"
};

const container = document.getElementById("sceneContainer");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0639a8");

const camera = new THREE.PerspectiveCamera(
  40,
  container.clientWidth / container.clientHeight,
  0.01,
  1000
);
camera.position.set(4, 2.5, 5);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.0;
controls.minDistance = 1;
controls.maxDistance = 30;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x3159a5, 2.2));

const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(5, 8, 6);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x00dfff, 2.2);
fillLight.position.set(-5, 3, -4);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x00f5ff, 18, 30);
rimLight.position.set(0, 4, -5);
scene.add(rimLight);

const grid = new THREE.GridHelper(18, 36, 0xffffff, 0x4c8eea);
grid.material.transparent = true;
grid.material.opacity = 0.16;
scene.add(grid);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let vehicle = null;
let selectableMeshes = [];
let hoveredMesh = null;
let selectedMesh = null;
let automaticRotation = true;
let pointerDownPosition = null;

const originalMaterials = new Map();
const edgeLines = new Map();
const cyanMaterials = new Map();

const cyanMaterial = new THREE.MeshBasicMaterial({
  color: 0x00f5ff,
  wireframe: true,
  transparent: true,
  opacity: 1,
  depthTest: false
});

const partInformation = [
  {
    keywords: ["wheel", "tire", "tyre", "rueda", "neumatic", "neumático"],
    title: "Neumáticos",
    description: "Ruedas del vehículo. Selecciona esta pieza para consultar los datos de presión disponibles.",
    sensor: "presion"
  },
  {
    keywords: ["engine", "motor", "hood", "bonnet", "capot"],
    title: "Motor",
    description: "Zona asociada al motor. Los valores proceden de la API del sensor de motor, no de una simulación física.",
    sensor: "motor"
  },
  {
    keywords: ["brake", "freno", "disc", "caliper", "rotor"],
    title: "Sistema de frenos",
    description: "Pieza o zona relacionada con los frenos. Consulta el estado reportado por la API de frenos.",
    sensor: "frenos"
  },
  {
    keywords: ["transmission", "gearbox", "transmision", "transmisión", "gear"],
    title: "Transmisión",
    description: "Zona relacionada con la transmisión. Los datos se consultan en el servicio correspondiente.",
    sensor: "transmision"
  },
  {
    keywords: ["fuel", "tank", "combustible", "gas"],
    title: "Combustible",
    description: "Zona asociada al sistema de combustible. Consulta el nivel o valor reportado por la API.",
    sensor: "combustible"
  },
  {
    keywords: ["radiator", "temperature", "temperatura", "cooling"],
    title: "Temperatura",
    description: "Zona asociada al control de temperatura. Consulta los valores de la API de temperatura.",
    sensor: "temperatura"
  },
  {
    keywords: ["door", "puerta", "glass", "window", "ventana", "body", "chassis", "carrocer"],
    title: "Carrocería",
    description: "Parte exterior del vehículo. Selecciona otras piezas para consultar sensores específicos.",
    sensor: null
  }
];

function getPartInfo(mesh) {
  const name = (mesh?.name || "").toLowerCase();

  for (const item of partInformation) {
    if (item.keywords.some(keyword => name.includes(keyword))) {
      return item;
    }
  }

  return {
    title: mesh?.name || "Pieza del vehículo",
    description: "Pieza del modelo 3D. El nombre procede del archivo del modelo. Si no tiene un sensor asociado, puedes consultar los sensores en el panel lateral.",
    sensor: null
  };
}

function setLoading(message) {
  loadingText.textContent = message;
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function makeMaterialCyan(mesh) {
  if (cyanMaterials.has(mesh)) {
    return cyanMaterials.get(mesh);
  }

  const material = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  cyanMaterials.set(mesh, material);
  return material;
}

function addWireframe(mesh) {
  const geometry = new THREE.EdgesGeometry(mesh.geometry, 25);
  const material = new THREE.LineBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: 0.85
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.name = `${mesh.name || "pieza"}_wireframe`;
  lines.renderOrder = 2;

  mesh.add(lines);
  edgeLines.set(mesh, lines);
}

function setMeshHighlight(mesh, enabled) {
  if (!mesh || !mesh.material) return;

  const original = originalMaterials.get(mesh);
  const lines = edgeLines.get(mesh);

  if (enabled) {
    mesh.material = makeMaterialCyan(mesh);

    if (lines) {
      lines.material.color.set(0x00f5ff);
      lines.material.opacity = 1;
    }
    return;
  }

  if (original) {
    mesh.material = original;
  }

  if (lines) {
    lines.material.color.set(0xf4fbff);
    lines.material.opacity = 0.85;
  }
}

function clearHighlight(mesh) {
  if (!mesh) return;

  if (mesh !== selectedMesh) {
    setMeshHighlight(mesh, false);
  }
}

function updateSelection(mesh) {
  if (selectedMesh && selectedMesh !== mesh) {
    setMeshHighlight(selectedMesh, false);
  }

  selectedMesh = mesh;

  if (selectedMesh) {
    setMeshHighlight(selectedMesh, true);
    showPartInfo(selectedMesh);
  } else {
    document.getElementById("partTitle").textContent = "Explora el vehículo";
    document.getElementById("partDescription").textContent =
      "Selecciona una pieza del modelo 3D para consultar la información relacionada.";
    document.getElementById("partState").textContent = "Esperando selección";
    document.getElementById("selectedLabel").textContent =
      "NINGUNA PIEZA SELECCIONADA";

    document.querySelectorAll(".sensor-card").forEach(card => {
      card.classList.remove("sensor-active");
    });
  }
}

function showPartInfo(mesh) {
  const info = getPartInfo(mesh);

  document.getElementById("partTitle").textContent = info.title;
  document.getElementById("partDescription").textContent = info.description;
  document.getElementById("partState").textContent =
    info.sensor ? "Sensor asociado" : "Pieza seleccionada";

  document.getElementById("selectedLabel").textContent =
    info.title.toUpperCase();

  document.querySelectorAll(".sensor-card").forEach(card => {
    card.classList.toggle(
      "sensor-active",
      Boolean(info.sensor) && card.dataset.sensor === info.sensor
    );
  });
}

function prepareModel(root) {
  vehicle = root;

  const box = new THREE.Box3().setFromObject(vehicle);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  vehicle.position.sub(center);

  const maxDimension = Math.max(size.x, size.y, size.z);

  if (maxDimension > 0) {
    const scale = 4.5 / maxDimension;
    vehicle.scale.setScalar(scale);
  }

  scene.add(vehicle);

  vehicle.traverse(object => {
    if (!object.isMesh) return;
    if (!object.geometry) return;

    selectableMeshes.push(object);
    originalMaterials.set(object, object.material);

    addWireframe(object);

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    materials.forEach(material => {
      if (!material) return;

      material.transparent = true;
      material.opacity = Math.min(material.opacity ?? 1, 0.24);
      material.depthWrite = false;
      material.needsUpdate = true;
    });
  });

  const fittedBox = new THREE.Box3().setFromObject(vehicle);
  const fittedSize = fittedBox.getSize(new THREE.Vector3());
  const maxSize = Math.max(fittedSize.x, fittedSize.y, fittedSize.z);

  camera.position.set(maxSize * 1.3, maxSize * 0.75, maxSize * 1.5);
  camera.near = Math.max(maxSize / 1000, 0.001);
  camera.far = maxSize * 100;
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.minDistance = maxSize * 0.5;
  controls.maxDistance = maxSize * 5;
  controls.update();

  document.getElementById("connectionText").textContent =
    "Modelo 3D cargado";

  hideLoading();
}

function loadModel() {
  setLoading("Cargando el coche 3D...");

  const loader = new GLTFLoader();

  loader.load(
    MODEL_PATH,
    gltf => {
      prepareModel(gltf.scene);
    },
    progress => {
      if (progress.total > 0) {
        const percentage = Math.round(
          (progress.loaded / progress.total) * 100
        );

        loadingText.textContent = `Cargando modelo 3D... ${percentage}%`;
      }
    },
    error => {
      console.error("No se pudo cargar el modelo:", error);

      setLoading(
        "No se pudo cargar el modelo. Revisa la ruta del archivo en app.js y la consola."
      );

      document.getElementById("connectionText").textContent =
        "Error al cargar modelo";
    }
  );
}

function getIntersections(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  return raycaster.intersectObjects(selectableMeshes, false);
}

renderer.domElement.addEventListener("pointermove", event => {
  if (pointerDownPosition) return;

  const hits = getIntersections(event);
  const hitMesh = hits.length ? hits[0].object : null;

  if (hoveredMesh !== hitMesh) {
    clearHighlight(hoveredMesh);
    hoveredMesh = hitMesh;

    if (hoveredMesh && hoveredMesh !== selectedMesh) {
      setMeshHighlight(hoveredMesh, true);
    }
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  clearHighlight(hoveredMesh);
  hoveredMesh = null;
});

renderer.domElement.addEventListener("pointerdown", event => {
  pointerDownPosition = {
    x: event.clientX,
    y: event.clientY
  };
});

renderer.domElement.addEventListener("pointerup", event => {
  if (!pointerDownPosition) return;

  const dx = event.clientX - pointerDownPosition.x;
  const dy = event.clientY - pointerDownPosition.y;
  const moved = Math.hypot(dx, dy) > 5;

  pointerDownPosition = null;

  if (moved) return;

  const hits = getIntersections(event);

  if (hits.length) {
    updateSelection(hits[0].object);
  } else {
    updateSelection(null);
  }
});

document.getElementById("resetView").addEventListener("click", () => {
  if (!vehicle) return;

  const box = new THREE.Box3().setFromObject(vehicle);
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  camera.position.set(maxSize * 1.3, maxSize * 0.75, maxSize * 1.5);
  controls.target.set(0, 0, 0);
  controls.update();

  updateSelection(null);
});

document.getElementById("toggleRotation").addEventListener("click", event => {
  automaticRotation = !automaticRotation;
  controls.autoRotate = automaticRotation;

  event.currentTarget.textContent =
    `Rotación automática: ${automaticRotation ? "sí" : "no"}`;

  event.currentTarget.classList.toggle("active", automaticRotation);
});

window.addEventListener("resize", () => {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});

async function fetchSensor(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// Busca valores en objetos, arreglos y respuestas anidadas.
function findValue(data, candidates) {
  if (data === null || data === undefined) return null;

  if (typeof data !== "object") {
    return data;
  }

  for (const key of candidates) {
    if (
      Object.prototype.hasOwnProperty.call(data, key) &&
      data[key] !== null &&
      data[key] !== undefined
    ) {
      return data[key];
    }
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const nested = findValue(item, candidates);

      if (nested !== null) {
        return nested;
      }
    }

    return null;
  }

  for (const key of [
    "data",
    "datos",
    "resultado",
    "result",
    "sensor",
    "lectura",
    "items"
  ]) {
    if (data[key] !== null && data[key] !== undefined) {
      const nested = findValue(data[key], candidates);

      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

function formatValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "Sin dato";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return `${value}${suffix}`;
}

// Convierte un valor a número si es válido.
function toValidNumber(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

// Obtiene el registro con el ID más alto de un arreglo.
function getLatestRecord(data) {
  if (!Array.isArray(data?.datos)) {
    return null;
  }

  const registros = data.datos.filter(registro =>
    registro && typeof registro === "object"
  );

  if (registros.length === 0) {
    return null;
  }

  return registros.reduce((anterior, actual) => {
    return Number(actual.id ?? 0) > Number(anterior.id ?? 0)
      ? actual
      : anterior;
  });
}

// Actualiza el indicador correspondiente en el panel de sensores.
function setSensorDisplay(prefix, data, candidates, suffix = "") {
  let value = null;

  // COMBUSTIBLE: leer porcentaje del registro más reciente.
  if (prefix === "fuel") {
    const ultimo = getLatestRecord(data);

    if (ultimo) {
      value = toValidNumber(ultimo.porcentaje);
    }

    if (value === null) {
      value = toValidNumber(findValue(data, candidates));
    }
  }

  // TEMPERATURA: leer valor_celsius del registro más reciente.
  else if (prefix === "temperature") {
    const ultimo = getLatestRecord(data);

    if (ultimo) {
      value = toValidNumber(ultimo.valor_celsius);
    }

    if (value === null) {
      value = toValidNumber(findValue(data, candidates));
    }
  }

  // PRESIÓN: leer las cuatro ruedas del último registro.
  else if (prefix === "pressure") {
    const ultimo = getLatestRecord(data);

    if (ultimo) {
      const delanteraDerecha =
        toValidNumber(ultimo.delantera_derecha);

      const delanteraIzquierda =
        toValidNumber(ultimo.delantera_izquierda);

      const traseraDerecha =
        toValidNumber(ultimo.trasera_derecha);

      const traseraIzquierda =
        toValidNumber(ultimo.trasera_izquierda);

      if (
        delanteraDerecha !== null &&
        delanteraIzquierda !== null &&
        traseraDerecha !== null &&
        traseraIzquierda !== null
      ) {
        value = {
          delantera_derecha: delanteraDerecha,
          delantera_izquierda: delanteraIzquierda,
          trasera_derecha: traseraDerecha,
          trasera_izquierda: traseraIzquierda
        };
      }
    }

    if (value === null) {
      value = findValue(data, candidates);
    }
  }

  // TRANSMISIÓN, FRENOS Y MOTOR: leer campo "estado" del registro más reciente.
  else if (
    prefix === "transmission" ||
    prefix === "brakes" ||
    prefix === "engine"
  ) {
    const ultimo = getLatestRecord(data);

    if (ultimo && ultimo.estado !== undefined) {
      value = ultimo.estado;
    }

    if (value === null || value === undefined) {
      value = findValue(data, candidates);
    }
  }

  // Los demás sensores conservan su lectura habitual.
  else {
    value = findValue(data, candidates);
  }

  const valueElement = document.getElementById(`${prefix}Value`);
  const detailElement = document.getElementById(`${prefix}Detail`);

  if (valueElement) {
    if (prefix === "pressure" && value !== null && typeof value === "object") {
      valueElement.textContent =
        `DI ${value.delantera_izquierda.toFixed(1)} | ` +
        `DD ${value.delantera_derecha.toFixed(1)} | ` +
        `TI ${value.trasera_izquierda.toFixed(1)} | ` +
        `TD ${value.trasera_derecha.toFixed(1)} PSI`;
    } else if (
      (prefix === "fuel" || prefix === "temperature") &&
      value !== null
    ) {
      const numericValue = Number(value);
      const unit = prefix === "fuel" ? "%" : " °C";

      valueElement.textContent = Number.isFinite(numericValue)
        ? `${numericValue.toFixed(2).replace(/\.?0+$/, "")}${unit}`
        : "Sin dato";
    } else {
      valueElement.textContent = formatValue(value, suffix);
    }
  }

  if (detailElement) {
    if (value === null || value === undefined) {
      detailElement.textContent =
        "API disponible; revisa la estructura del JSON";
    } else if (prefix === "pressure" && typeof value === "object") {
      detailElement.textContent =
        "Presión de los cuatro neumáticos recibida";
    } else {
      detailElement.textContent = "Dato recibido correctamente";
    }
  }
}

function setApiStatus(id, message, isError = false) {
  const element = document.getElementById(id);

  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
}

async function refreshSensors() {
  setApiStatus("api5000", "Consultando...");
  setApiStatus("api8000", "Consultando...");

  const results = await Promise.allSettled([
    fetchSensor(API.temperatura),
    fetchSensor(API.presion),
    fetchSensor(API.combustible),
    fetchSensor(API.transmision),
    fetchSensor(API.frenos),
    fetchSensor(API.motor)
  ]);

  const keys = [
    "temperatura",
    "presion",
    "combustible",
    "transmision",
    "frenos",
    "motor"
  ];

  const success = {};

  keys.forEach((key, index) => {
    success[key] = results[index].status === "fulfilled";
  });

  // TEMPERATURA
  if (success.temperatura) {
    setSensorDisplay(
      "temperature",
      results[0].value,
      [
        "valor_celsius",
        "temperatura",
        "temperature",
        "valor",
        "lectura",
        "grados"
      ],
      " °C"
    );
  } else {
    document.getElementById("temperatureValue").textContent =
      "No disponible";

    document.getElementById("temperatureDetail").textContent =
      results[0].reason?.message || "Error de conexión o CORS";
  }

  // PRESIÓN DE NEUMÁTICOS
  if (success.presion) {
    setSensorDisplay(
      "pressure",
      results[1].value,
      [
        "delantera_derecha",
        "delantera_izquierda",
        "trasera_derecha",
        "trasera_izquierda",
        "presion",
        "presión",
        "pressure",
        "valor",
        "lectura",
        "psi"
      ]
    );
  } else {
    document.getElementById("pressureValue").textContent =
      "No disponible";

    document.getElementById("pressureDetail").textContent =
      results[1].reason?.message || "Error de conexión o CORS";
  }

  // COMBUSTIBLE
  if (success.combustible) {
    setSensorDisplay(
      "fuel",
      results[2].value,
      [
        "porcentaje",
        "combustible",
        "fuel",
        "nivel",
        "valor",
        "lectura"
      ],
      "%"
    );
  } else {
    document.getElementById("fuelValue").textContent =
      "No disponible";

    document.getElementById("fuelDetail").textContent =
      results[2].reason?.message || "Error de conexión o CORS";
  }

  // TRANSMISIÓN
  if (success.transmision) {
    setSensorDisplay(
      "transmission",
      results[3].value,
      [
        "estado",
        "transmision",
        "transmisión",
        "valor",
        "lectura"
      ]
    );
  } else {
    document.getElementById("transmissionValue").textContent =
      "No disponible";

    document.getElementById("transmissionDetail").textContent =
      results[3].reason?.message || "Error de conexión o CORS";
  }

  // FRENOS
  if (success.frenos) {
    setSensorDisplay(
      "brakes",
      results[4].value,
      [
        "estado",
        "frenos",
        "valor",
        "lectura"
      ]
    );
  } else {
    document.getElementById("brakesValue").textContent =
      "No disponible";

    document.getElementById("brakesDetail").textContent =
      results[4].reason?.message || "Error de conexión o CORS";
  }

  // MOTOR
  if (success.motor) {
    setSensorDisplay(
      "engine",
      results[5].value,
      [
        "estado",
        "motor",
        "valor",
        "lectura"
      ]
    );
  } else {
    document.getElementById("engineValue").textContent =
      "No disponible";

    document.getElementById("engineDetail").textContent =
      results[5].reason?.message || "Error de conexión o CORS";
  }

  const firstGroupOK =
    success.temperatura &&
    success.presion &&
    success.combustible;

  const secondGroupOK =
    success.transmision &&
    success.frenos &&
    success.motor;

  setApiStatus(
    "api5000",
    firstGroupOK ? "Conectadas" : "Error de acceso",
    !firstGroupOK
  );

  setApiStatus(
    "api8000",
    secondGroupOK ? "Conectadas" : "Error de acceso",
    !secondGroupOK
  );
}

document.getElementById("refreshSensors").addEventListener(
  "click",
  refreshSensors
);

loadModel();
refreshSensors();
setInterval(refreshSensors, 15000);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();