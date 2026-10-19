import { Planet } from "./Planet";
import { stars } from "./geometry";
import styles from "./Scene.module.css";

const starClass = [styles.star1, styles.star2, styles.star3, styles.star4];

export function Scene() {
  return (
    <div className={styles.scene} data-scene aria-hidden="true">
      <div className={`${styles.layer} ${styles.dayPlate}`} data-scene-plate="day" />
      <div className={`${styles.layer} ${styles.nightPlate}`} data-scene-plate="night" />
      <svg className={styles.starfield} viewBox="0 0 1440 1040" preserveAspectRatio="xMidYMin slice">
        <g className={styles.stars}>
          {stars.map((star, index) => (
            <circle
              key={`${star.cx}-${star.cy}-${index}`}
              cx={star.cx}
              cy={star.cy}
              r={star.r}
              className={starClass[star.phase - 1]}
            />
          ))}
        </g>
      </svg>
      <Planet />
    </div>
  );
}
