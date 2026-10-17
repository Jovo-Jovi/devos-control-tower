/// <reference types="next/image-types/global" />
import sphereMap from "./assets/planet-sphere-map.png";
import styles from "./Planet.module.css";

export function Planet() {
  return (
    <div className={styles.slot}>
      <div className={styles.glowDay} />
      <div className={styles.glowNight} />
      <div className={styles.disc}>
        <svg className={styles.filter} width="0" height="0" aria-hidden="true">
          <filter
            id="sphere"
            x="0"
            y="0"
            width="340"
            height="340"
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={sphereMap.src}
              x="0"
              y="0"
              width="340"
              height="340"
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="200" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <div className={styles.globe}>
          <div className={styles.spin}>
            <div className={styles.turn} data-planet-turn>
              <div className={`${styles.strip} ${styles.land}`} />
            </div>
          </div>
          <div className={`${styles.spin} ${styles.spinClouds}`}>
            <div className={styles.turn} data-planet-turn>
              <div className={`${styles.strip} ${styles.cloudStrip}`} />
            </div>
          </div>
        </div>
        <div className={styles.night} />
        <div className={styles.lightsMask}>
          <div className={styles.globe}>
            <div className={styles.spin}>
              <div className={styles.turn} data-planet-turn>
                <div className={`${styles.strip} ${styles.lights}`} />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.rim} />
        <div className={styles.shade} />
        <div className={styles.atmo} />
      </div>
    </div>
  );
}
