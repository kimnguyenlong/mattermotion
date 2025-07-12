import { useEffect } from "preact/hooks";
import * as THREE from "https://esm.sh/three@0.150.1";
import { OrbitControls } from "OrbitControls";

export default function ThreeScene() {
  useEffect(() => {
    // Set up scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      globalThis.innerWidth / globalThis.innerHeight,
      0.1,
      1000,
    );
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add OrbitControls for zooming and panning
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    controls.enablePan = true;
    controls.enableZoom = true;

    // Add ambient and point light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const sunLight = new THREE.PointLight(0xffffff, 1.5, 100);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // Create moving starfield (as Points)
    const starCount = 3000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starVelocities = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      // Random position in a sphere shell
      const r = 90 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      // Small random velocity
      starVelocities[i * 3] = (Math.random() - 0.5) * 0.01;
      starVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      starVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0.8,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    function createTextSprite(text: string) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "rgba(0, 0, 0, 0.7)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = "48px Arial";
        context.fillStyle = "white";
        context.textAlign = "center";
        context.fillText(text, canvas.width / 2, canvas.height / 2);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(4, 1, 1);
      return sprite;
    }

    // Create Sun
    const sunGeometry = new THREE.SphereGeometry(2, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Add Sun label
    const sunLabel = createTextSprite("Sun");
    sunLabel.position.set(0, 3.5, 0);
    sun.add(sunLabel);

    // Planet data: [radius, distance from sun, orbital speed, color]
    const planetsData = [
      {
        name: "Mercury",
        radius: 0.3,
        distance: 4,
        speed: 0.04,
        color: 0xbbbbbb,
      },
      {
        name: "Venus",
        radius: 0.5,
        distance: 6,
        speed: 0.015,
        color: 0xffd700,
      },
      { name: "Earth", radius: 0.6, distance: 8, speed: 0.01, color: 0x00b7eb },
      {
        name: "Mars",
        radius: 0.4,
        distance: 10,
        speed: 0.008,
        color: 0xff4500,
      },
      {
        name: "Jupiter",
        radius: 1.2,
        distance: 14,
        speed: 0.004,
        color: 0xff8c00,
      },
      {
        name: "Saturn",
        radius: 1.0,
        distance: 18,
        speed: 0.003,
        color: 0xffe4b5,
      },
      {
        name: "Uranus",
        radius: 0.8,
        distance: 22,
        speed: 0.002,
        color: 0x00fa9a,
      },
      {
        name: "Neptune",
        radius: 0.8,
        distance: 26,
        speed: 0.0015,
        color: 0x1e90ff,
      },
    ];

    const planets: {
      mesh: THREE.Mesh<
        THREE.SphereGeometry,
        THREE.MeshPhongMaterial
      >;
      distance: number;
      speed: number;
      angle: number;
      moon?: {
        mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;
        distance: number;
        speed: number;
        angle: number;
        label: THREE.Sprite;
      };
    }[] = [];

    // Helper to create orbit circle
    function createOrbitCircle(distance: number, color: number = 0xffffff) {
      const curve = new THREE.EllipseCurve(
        0, 0, // ax, aY
        distance, distance, // xRadius, yRadius
        0, 2 * Math.PI, // startAngle, endAngle
        false, // clockwise
        0 // rotation
      );
      const points = curve.getPoints(128);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color, opacity: 0.5, transparent: true });
      const ellipse = new THREE.Line(geometry, material);
      ellipse.rotation.x = Math.PI / 2; // Make it horizontal
      return ellipse;
    }

    // Create planets and their orbit circles
    let earthObj: typeof planets[0] | undefined;
    let marsObj: typeof planets[0] | undefined;

    planetsData.forEach((data) => {
      const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
      const material = new THREE.MeshPhongMaterial({ color: data.color });
      const planet = new THREE.Mesh(geometry, material);
      planet.position.x = data.distance;
      scene.add(planet);

      // Add label to planet
      const label = createTextSprite(data.name);
      label.position.set(0, data.radius + 0.5, 0);
      planet.add(label);

      // Highlight Earth with a glowing ring
      let moonObj;
      if (data.name === "Earth") {
        const ringGeometry = new THREE.TorusGeometry(
          data.radius + 0.2,
          0.05,
          16,
          100,
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        planet.add(ring);

        // Add Moon
        const moonRadius = 0.16;
        const moonDistance = 1.2;
        const moonSpeed = 0.04;
        const moonGeometry = new THREE.SphereGeometry(moonRadius, 16, 16);
        const moonMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        const moon = new THREE.Mesh(moonGeometry, moonMaterial);
        planet.add(moon);

        // Add Moon label
        const moonLabel = createTextSprite("Moon");
        moonLabel.position.set(0, moonRadius + 0.3, 0);
        moon.add(moonLabel);

        // Add Moon orbit circle
        const moonOrbit = createOrbitCircle(moonDistance, 0xaaaaaa);
        moonOrbit.position.set(0, 0, 0);
        planet.add(moonOrbit);

        moonObj = {
          mesh: moon,
          distance: moonDistance,
          speed: moonSpeed,
          angle: Math.random() * Math.PI * 2,
          label: moonLabel,
        };
      }

      // Add orbit circle for this planet
      const orbitCircle = createOrbitCircle(data.distance, 0x888888);
      scene.add(orbitCircle);

      const planetObj = {
        mesh: planet,
        distance: data.distance,
        speed: data.speed,
        angle: Math.random() * Math.PI * 2,
        moon: moonObj,
      };

      if (data.name === "Earth") earthObj = planetObj;
      if (data.name === "Mars") marsObj = planetObj;

      planets.push(planetObj);
    });

    // Set camera position
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);

    // --- Starship setup ---
    // Smaller starship: cylinder + cone
    const starshipGroup = new THREE.Group();

    const shipBodyGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16); // smaller
    const shipBodyMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const shipBody = new THREE.Mesh(shipBodyGeometry, shipBodyMaterial);
    shipBody.position.y = 0.15;
    starshipGroup.add(shipBody);

    const shipNoseGeometry = new THREE.ConeGeometry(0.05, 0.09, 16); // smaller
    const shipNoseMaterial = new THREE.MeshPhongMaterial({ color: 0x8888ff });
    const shipNose = new THREE.Mesh(shipNoseGeometry, shipNoseMaterial);
    shipNose.position.y = 0.345;
    starshipGroup.add(shipNose);

    // Add label
    const shipLabel = createTextSprite("Starship");
    shipLabel.position.set(0, 0.5, 0); // adjust for smaller ship
    starshipGroup.add(shipLabel);

    scene.add(starshipGroup);

    // Starship travel parameters
    // 0 = Earth->Mars, 1 = Mars->Earth
    let starshipLeg = 0;
    let starshipProgress = 0;
    const starshipSpeed = 0.002;
    let starshipDirection = 1;

    // --- Starship trajectory curve ---
    let trajectoryLine: THREE.Line | null = null;

    // Quadratic Bezier interpolation
    function bezier(t: number, p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3) {
      const oneMinusT = 1 - t;
      return new THREE.Vector3(
        oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
        oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
        oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * t * p1.z + t * t * p2.z
      );
    }

    function updateTrajectoryCurve() {
      let fromObj, toObj;
      if (starshipLeg === 0 && earthObj && marsObj) {
        fromObj = earthObj;
        toObj = marsObj;
      } else if (starshipLeg === 1 && marsObj && earthObj) {
        fromObj = marsObj;
        toObj = earthObj;
      } else {
        return;
      }

      const fromPos = fromObj.mesh.position.clone();
      const toPos = toObj.mesh.position.clone();
      const control = new THREE.Vector3(
        (fromPos.x + toPos.x) / 2,
        3,
        (fromPos.z + toPos.z) / 2
      );

      const curvePoints: THREE.Vector3[] = [];
      const segments = 100;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        curvePoints.push(bezier(t, fromPos, control, toPos));
      }

      if (trajectoryLine) {
        scene.remove(trajectoryLine);
      }
      const curveGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const curveMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 2,
        transparent: true,
        opacity: 0.7,
      });
      trajectoryLine = new THREE.Line(curveGeometry, curveMaterial);
      scene.add(trajectoryLine);
    }

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);

      // Rotate Sun
      sun.rotation.y += 0.005;

      // Orbit planets
      planets.forEach((planet) => {
        planet.angle += planet.speed;
        planet.mesh.position.x = planet.distance * Math.cos(planet.angle);
        planet.mesh.position.z = planet.distance * Math.sin(planet.angle);
        planet.mesh.rotation.y += 0.01;

        // Animate Moon if present
        if (planet.moon) {
          planet.moon.angle += planet.moon.speed;
          planet.moon.mesh.position.x = planet.moon.distance * Math.cos(planet.moon.angle);
          planet.moon.mesh.position.z = planet.moon.distance * Math.sin(planet.moon.angle);
        }
      });

      // Move stars slowly
      const positions = starGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < starCount; i++) {
        let x = positions.getX(i) + starVelocities[i * 3];
        let y = positions.getY(i) + starVelocities[i * 3 + 1];
        let z = positions.getZ(i) + starVelocities[i * 3 + 2];

        // Keep stars within a shell
        const r = Math.sqrt(x * x + y * y + z * z);
        if (r > 100) {
          x *= 0.9;
          y *= 0.9;
          z *= 0.9;
        }
        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;

      // --- Starship animation ---
      let fromObj, toObj;
      if (starshipLeg === 0 && earthObj && marsObj) {
        fromObj = earthObj;
        toObj = marsObj;
      } else if (starshipLeg === 1 && marsObj && earthObj) {
        fromObj = marsObj;
        toObj = earthObj;
      }

      if (fromObj && toObj) {
        const fromPos = fromObj.mesh.position;
        const toPos = toObj.mesh.position;

        starshipProgress += starshipSpeed * starshipDirection;
        if (starshipProgress > 1) {
          starshipProgress = 1;
          if (starshipLeg < 1) {
            starshipLeg++;
            starshipProgress = 0;
            starshipDirection = 1;
          } else {
            // After Mars->Earth, reverse direction to go back to Mars
            starshipDirection = -1;
          }
        }
        if (starshipProgress < 0) {
          starshipProgress = 0;
          if (starshipLeg > 0) {
            starshipLeg--;
            starshipProgress = 1;
            starshipDirection = -1;
          } else {
            // After Earth->Mars, reverse direction to go forward again
            starshipDirection = 1;
          }
        }

        const control = new THREE.Vector3(
          (fromPos.x + toPos.x) / 2,
          3,
          (fromPos.z + toPos.z) / 2
        );
        const shipPos = bezier(starshipProgress, fromPos.clone(), control, toPos.clone());
        starshipGroup.position.copy(shipPos);

        // Orient starship to face direction of travel (tangent to curve)
        const nextT = Math.min(Math.max(starshipProgress + 0.001 * starshipDirection, 0), 1);
        const nextPos = bezier(nextT, fromPos.clone(), control, toPos.clone());
        const dir = nextPos.clone().sub(shipPos).normalize();

        starshipGroup.lookAt(shipPos.clone().add(dir));

        updateTrajectoryCurve();
      }

      renderer.render(scene, camera);
    }

    animate();

    // Handle globalThis resize
    globalThis.addEventListener("resize", () => {
      camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
    });
  }, []);

  return null;
}
