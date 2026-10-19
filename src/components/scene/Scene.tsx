import { Starfield } from "./Starfield";
import { Planet } from "./Planet";
import styles from "./Scene.module.css";

export function Scene() {
  return (
    <div className={styles.scene} data-scene aria-hidden="true">
      <div className={`${styles.layer} ${styles.dayPlate}`} data-scene-plate="day" />
      <div className={styles.clouds} data-scene-clouds>
        <div className={`${styles.cloudLayer} ${styles.cloudFar}`}>
          <div className={`${styles.cloudTrack} ${styles.cloudTrackFar}`} data-cloud-track="far">
            <div className={styles.cloudTile} />
            <div className={styles.cloudTile} />
          </div>
        </div>
        <div className={`${styles.cloudLayer} ${styles.cloudNear}`}>
          <div className={`${styles.cloudTrack} ${styles.cloudTrackNear}`} data-cloud-track="near">
            <div className={styles.cloudTile} />
            <div className={styles.cloudTile} />
          </div>
        </div>
      </div>
      <div className={`${styles.layer} ${styles.nightPlate}`} data-scene-plate="night" />
      <div className={styles.mist} data-scene-mist>
        <div className={styles.mistTrack} />
      </div>
      <Starfield />
      <Planet />
    </div>
  );
}
