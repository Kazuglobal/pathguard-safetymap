import { useEffect, useRef, useState } from 'react'
import type { Viewer as CesiumViewerType, PostProcessStage as CesiumPostProcessStageType, Entity as CesiumEntity } from 'cesium'

// 東京・渋谷駅周辺のデフォルト座標
const POC_LON = 139.7006
const POC_LAT = 35.6585
// WGS84楕円体高（東京平均地上高 ≒ 38m）
const GROUND_ELLIPSOID_H_TOKYO = 38
// 一般的な日本の地面高さ（日本全体の近似値）
const APPROX_GROUND_H_JAPAN = 40

export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog'

export interface HazardPin {
  id: string
  lon: number
  lat: number
  comment: string
}

interface Location {
  lon: number
  lat: number
}

interface CesiumViewerProps {
  hourOfDay: number
  location: Location | null
  eyeHeight?: number // in meters
  weather?: WeatherType
  routeCoordinates?: Location[] // List of coordinates for the route
  isAutoWalking?: boolean // Toggle for auto-walk
  hazards?: HazardPin[]
  onMapClick?: (lon: number, lat: number) => void
  showXRoad?: boolean
}

// 簡易的なxROADダミーデータ（渋谷周辺の「歩道がない」等の危険箇所想定）
const DUMMY_XROAD_POINTS = [
  { lon: 139.7001, lat: 35.6581, title: '歩道未整備区間' },
  { lon: 139.6995, lat: 35.6595, title: 'ガードレール欠損' },
];

export default function CesiumViewer({
  hourOfDay,
  location,
  eyeHeight = 1.1, // Default child eye height
  weather = 'clear',
  routeCoordinates = [],
  isAutoWalking = false,
  hazards = [],
  onMapClick,
  showXRoad = false,
}: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CesiumViewerType | null>(null)

  // Storage for entities
  const routeEntityRef = useRef<CesiumEntity | null>(null)
  const hazardsRef = useRef<CesiumEntity[]>([])
  const xroadRef = useRef<CesiumEntity[]>([])

  const [currentWalkIndex, setCurrentWalkIndex] = useState(0)

  // Weather effect references
  const fogStageRef = useRef<CesiumPostProcessStageType | null>(null)

  // ① 初期化: マウント時1回のみ
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return
    let destroyed = false

    async function init() {
      // Turbopackは DefinePlugin 不可のため、import前に手動設定
      ; (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium'

      const Cesium = await import('cesium')

      // TurbopackではCSS importが動作しないため動的注入
      if (!document.head.querySelector('link[data-cesium-widgets="true"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = '/cesium/Widgets/widgets.css'
        link.dataset.cesiumWidgets = 'true'
        document.head.appendChild(link)
      }

      if (destroyed || !containerRef.current) return

      Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? ''

      const viewer = new Cesium.Viewer(containerRef.current, {
        globe: false,           // Google 3D Tilesで地形を上書きするため無効化
        shadows: true,
        terrainShadows: Cesium.ShadowMode.ENABLED,
        // PoCのためUIウィジェットは非表示
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      })
      viewerRef.current = viewer

      // Google Photorealistic 3D Tiles 読み込み
      try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset({
          key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        })
        viewer.scene.primitives.add(tileset)
      } catch (err) {
        console.error('[CesiumViewer] Google 3D Tiles 読み込み失敗:', err)
      }

      viewer.shadowMap.size = 2048
      viewer.shadowMap.softShadows = true

      // 初期カメラ設定
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(POC_LON, POC_LAT, GROUND_ELLIPSOID_H_TOKYO + eyeHeight),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-5), // 自然な前方視線（やや下向き）
          roll: 0,
        },
      })

      // Setup Click Handler for Hazard Pins
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        // We only want to add pins if not actively walking
        if (!viewer.scene.globe && viewer.scene.pickPositionSupported) {
          const pickedObject = viewer.scene.pick(click.position);
          if (viewer.scene.pickPositionSupported) {
            const cartesian = viewer.scene.pickPosition(click.position);
            if (cartesian) {
              const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
              const lon = Cesium.Math.toDegrees(cartographic.longitude);
              const lat = Cesium.Math.toDegrees(cartographic.latitude);
              if (onMapClick) onMapClick(lon, lat);
            }
          }
        } else {
          // Fallback raycast if globe is active (it's not but for safety)
          const ray = viewer.camera.getPickRay(click.position);
          if (ray) {
            const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            if (cartesian) {
              const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
              const lon = Cesium.Math.toDegrees(cartographic.longitude);
              const lat = Cesium.Math.toDegrees(cartographic.latitude);
              if (onMapClick) onMapClick(lon, lat);
            }
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // Setup Fog Post Process Stage
      const fogShader = `
        uniform sampler2D colorTexture;
        uniform sampler2D depthTexture;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;
        void main(void)
        {
            vec4 color = texture(colorTexture, v_textureCoordinates);
            float depth = czm_readDepth(depthTexture, v_textureCoordinates);
            vec4 positionEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
            float distance = length(positionEC.xyz);
            // Example fog density
            float fogDensity = 0.005;
            float fogFactor = exp(-pow(distance * fogDensity, 2.0));
            fogFactor = clamp(fogFactor, 0.0, 1.0);
            vec4 fogColor = vec4(0.8, 0.8, 0.8, 1.0); // Light gray fog
            fragColor = mix(fogColor, color, fogFactor);
        }
      `;
      const fogStage = viewer.scene.postProcessStages.add(new Cesium.PostProcessStage({
        fragmentShader: fogShader
      }));
      fogStage.enabled = false;
      fogStageRef.current = fogStage;

    }

    init()

    return () => {
      destroyed = true
      if (viewerRef.current && viewerRef.current.isDestroyed?.() === false) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [onMapClick]) // Added onMapClick to deps since it's bound to the click handler

  // ② 場所・高さ変更: locationまたはeyeHeight変化時にカメラを飛行/移動
  useEffect(() => {
    // 処理中の自動ウォークルーがある場合はユーザの明示的クリック指示以外のlocation変更を弾きたいが
    // ここではシンプルにそのまま移動する仕様とする
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed?.() || isAutoWalking) return

    import('cesium').then(({ Cartesian3 }) => {
      const targetLon = location ? location.lon : POC_LON
      const targetLat = location ? location.lat : POC_LAT
      const baseH = location ? APPROX_GROUND_H_JAPAN : GROUND_ELLIPSOID_H_TOKYO
      const targetH = baseH + eyeHeight

      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(targetLon, targetLat, targetH),
        orientation: {
          heading: viewer.camera.heading, // Keep current heading
          pitch: viewer.camera.pitch,     // Keep current pitch
          roll: 0,
        },
        duration: location ? 1.5 : 0.5, // Faster transition just for height change
      })
    })
  }, [location, eyeHeight, isAutoWalking])

  // ③ 時間帯変更: hourOfDay変化時のみ
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed?.()) return

    import('cesium').then(({ JulianDate }) => {
      const d = new Date()
      d.setHours(Math.floor(hourOfDay), Math.round((hourOfDay % 1) * 60), 0, 0)
      viewer.clock.currentTime = JulianDate.fromDate(d)
      viewer.clock.multiplier = 0
      viewer.clock.shouldAnimate = false
    })
  }, [hourOfDay])

  // ④ 天候変更: weather変化時
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;

    if (fogStageRef.current) {
      fogStageRef.current.enabled = (weather === 'fog' || weather === 'rain' || weather === 'snow');
    }

    // Additional weather states (skycolor, lighting tweaks) can be done here.
    switch (weather) {
      case 'clear':
        viewer.scene.skyAtmosphere.hueShift = 0.0;
        viewer.scene.skyAtmosphere.saturationShift = 0.0;
        viewer.scene.skyAtmosphere.brightnessShift = 0.0;
        break;
      case 'rain':
        viewer.scene.skyAtmosphere.hueShift = -0.5; // Cooler
        viewer.scene.skyAtmosphere.saturationShift = -0.5; // Less saturated
        viewer.scene.skyAtmosphere.brightnessShift = -0.4; // Darker
        break;
      case 'snow':
        viewer.scene.skyAtmosphere.hueShift = 0.0;
        viewer.scene.skyAtmosphere.saturationShift = -0.7; // Grayscale-ish
        viewer.scene.skyAtmosphere.brightnessShift = 0.2; // Brighter due to scattering
        break;
      case 'fog':
        viewer.scene.skyAtmosphere.hueShift = 0.0;
        viewer.scene.skyAtmosphere.saturationShift = -0.3;
        viewer.scene.skyAtmosphere.brightnessShift = -0.1;
        break;
    }

  }, [weather]);

  // ⑤ ルート描画
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;

    import('cesium').then(({ Color, Cartesian3 }) => {
      // Remove old route
      if (routeEntityRef.current) {
        viewer.entities.remove(routeEntityRef.current);
        routeEntityRef.current = null;
      }

      if (routeCoordinates && routeCoordinates.length > 1) {
        const positions = routeCoordinates.map(coord =>
          Cartesian3.fromDegrees(coord.lon, coord.lat, APPROX_GROUND_H_JAPAN + 0.5) // Slightly above ground
        );

        routeEntityRef.current = viewer.entities.add({
          polyline: {
            positions: positions,
            width: 5,
            material: Color.BLUE.withAlpha(0.7),
            clampToGround: true, // Note: standard Cesium doesn't easily clamp onto 3D tiles without globe, so we raise it manually
          }
        });
      }
    });

  }, [routeCoordinates]);

  // ⑥ 自動ウォークスルー (Auto Walk)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.() || !routeCoordinates || routeCoordinates.length < 2) return;

    let timeoutId: NodeJS.Timeout;

    if (isAutoWalking) {
      // Start or continue walking
      import('cesium').then(({ Cartesian3, Math: CesiumMath }) => {
        const walk = () => {
          if (!isAutoWalking) return;

          const nextIndex = (currentWalkIndex + 1) < routeCoordinates.length ? currentWalkIndex + 1 : 0;

          if (nextIndex === 0) {
            // Reached the end, you could either loop or stop. Let's loop for now.
            setCurrentWalkIndex(0);
          } else {
            const nextCoord = routeCoordinates[nextIndex];
            const currentCoord = routeCoordinates[currentWalkIndex];

            // Calculate heading towards the next point
            const dx = nextCoord.lon - currentCoord.lon;
            const dy = nextCoord.lat - currentCoord.lat;
            const heading = Math.atan2(dx, dy); // Simplified 2D heading

            viewer.camera.flyTo({
              destination: Cartesian3.fromDegrees(nextCoord.lon, nextCoord.lat, APPROX_GROUND_H_JAPAN + eyeHeight),
              orientation: {
                heading: heading,
                pitch: CesiumMath.toRadians(-5),
                roll: 0,
              },
              duration: 2.0, // Simulate ~4km/h depending on distance, hardcoded duration for PoC simplicity
            });

            setCurrentWalkIndex(nextIndex);
          }

          // Schedule next step. Wait for flyTo to finish (~2s) plus a small buffer
          if (nextIndex !== 0) {
            timeoutId = setTimeout(walk, 2500);
          }
        };

        // Trigger first step
        walk();
      });
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

  }, [isAutoWalking, currentWalkIndex, routeCoordinates, eyeHeight]);

  // ⑦ 危険箇所（ハザード）ピンの描画
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;

    import('cesium').then(({ Cartesian3, Color, VerticalOrigin, HorizontalOrigin }) => {
      // Clear old hazards
      hazardsRef.current.forEach(entity => viewer.entities.remove(entity));
      hazardsRef.current = [];

      hazards.forEach(hazard => {
        const entity = viewer.entities.add({
          position: Cartesian3.fromDegrees(hazard.lon, hazard.lat, APPROX_GROUND_H_JAPAN + 2),
          point: {
            pixelSize: 15,
            color: Color.RED,
            outlineColor: Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: hazard.comment,
            font: '14px sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: 2, // LABEL_STYLE.FILL_AND_OUTLINE
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            pixelOffset: { x: 0, y: -20 } as any, // Vector2
          }
        });
        hazardsRef.current.push(entity);
      });
    });
  }, [hazards]);

  // ⑧ xROADデータの表示切替
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;

    import('cesium').then(({ Cartesian3, Color }) => {
      // Clear old xroad
      xroadRef.current.forEach(entity => viewer.entities.remove(entity));
      xroadRef.current = [];

      if (showXRoad) {
        DUMMY_XROAD_POINTS.forEach(pt => {
          const entity = viewer.entities.add({
            position: Cartesian3.fromDegrees(pt.lon, pt.lat, APPROX_GROUND_H_JAPAN + 0.1),
            polygon: {
              hierarchy: {
                positions: Cartesian3.fromDegreesArray([
                  pt.lon - 0.0001, pt.lat - 0.0001,
                  pt.lon + 0.0001, pt.lat - 0.0001,
                  pt.lon + 0.0001, pt.lat + 0.0001,
                  pt.lon - 0.0001, pt.lat + 0.0001,
                ])
              } as any,
              material: Color.ORANGE.withAlpha(0.5),
            },
            label: {
              text: pt.title,
              font: '12px sans-serif',
              fillColor: Color.ORANGE,
              outlineColor: Color.BLACK,
              outlineWidth: 1,
              pixelOffset: { x: 0, y: -10 } as any
            }
          });
          xroadRef.current.push(entity);
        });
      }
    });
  }, [showXRoad]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#1a1a2e' }}
    />
  )
}
