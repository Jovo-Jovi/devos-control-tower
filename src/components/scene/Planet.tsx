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
            <feDisplacementMap in="SourceGraphic" in2="map" scale="300" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <div className={styles.globe} data-planet-globe="day">
          <div className={styles.spin}>
            <div className={styles.turn} data-planet-turn>
              <div className={`${styles.strip} ${styles.dayStrip}`} />
            </div>
          </div>
        </div>
        <div className={styles.crimsonMask} data-planet-crimson-mask>
          <div className={styles.globe} data-planet-globe="crimson">
            <div className={styles.spin}>
              <div className={styles.turn} data-planet-turn>
                <div className={`${styles.strip} ${styles.crimsonStrip}`} />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.shade} />
        <div className={styles.atmo} />
      </div>
    </div>
  );
}
