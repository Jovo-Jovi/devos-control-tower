import { PlanetGlobe } from "./PlanetGlobe";
import styles from "./Planet.module.css";

export function Planet() {
  return (
    <div className={styles.slot} data-planet-slot>
      <div className={styles.glowDay} />
      <div className={styles.glowNight} />
      <div className={styles.disc}>
        <div className={styles.globe} data-planet-globe="day">
          <div className={styles.spin} data-planet-spin>
            <div className={styles.turn} data-planet-turn>
              <div className={`${styles.strip} ${styles.dayStrip}`} data-planet-strip />
            </div>
          </div>
          <PlanetGlobe side="day" />
        </div>
        <div className={styles.crimsonMask} data-planet-crimson-mask>
          <div className={styles.globe} data-planet-globe="crimson">
            <div className={styles.spin} data-planet-spin>
              <div className={styles.turn} data-planet-turn>
                <div className={`${styles.strip} ${styles.crimsonStrip}`} data-planet-strip />
              </div>
            </div>
            <PlanetGlobe side="crimson" />
          </div>
        </div>
        <div className={styles.shade} />
        <div className={styles.atmo} />
      </div>
    </div>
  );
}
