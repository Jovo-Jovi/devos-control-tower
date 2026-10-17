import { Planet } from "./Planet";
import { cloudSea, farRim, farSkyline, nearRim, nearSkyline, stars, windows } from "./geometry";
import styles from "./Scene.module.css";

const starClass = [styles.star1, styles.star2, styles.star3, styles.star4];

export function Scene() {
  return (
    <div className={styles.scene} data-scene aria-hidden="true">
      <div className={`${styles.layer} ${styles.dayBackdrop}`} />
      <div className={`${styles.layer} ${styles.nightBackdrop}`} />
      <div className={`${styles.layer} ${styles.cloudLayer}`}>
        <div className={styles.cloudPan} />
      </div>
      <svg className={styles.skyline} viewBox="0 0 1440 1040" preserveAspectRatio="xMidYMin slice">
        <defs>
          <linearGradient id="dayNear" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className={styles.nearStart} />
            <stop offset="1" className={styles.nearEnd} />
          </linearGradient>
          <filter id="cloudBlur" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>
        <g className={styles.night}>
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
          <polygon points={farSkyline} className={styles.nightFar} />
          <polyline points={farRim} className={styles.nightFarRim} />
          <polygon points={nearSkyline} className={styles.nightNear} />
          <polyline points={nearRim} className={styles.nightNearRim} />
          <g className={styles.windows}>
            {windows.map((pane, index) => (
              <rect key={`${pane.x}-${pane.y}-${index}`} x={pane.x} y={pane.y} width="2" height="2" />
            ))}
          </g>
          <rect y="718" width="1440" height="322" className={styles.nightGround} />
        </g>
        <g className={styles.day}>
          <polygon points={farSkyline} className={styles.dayFar} />
          <polygon points={nearSkyline} fill="url(#dayNear)" />
          <polyline points={nearRim} className={styles.dayRim} />
          <g className={styles.cloudSea} filter="url(#cloudBlur)">
            {cloudSea.map((cloud) => (
              <ellipse
                key={`${cloud.cx}-${cloud.cy}`}
                cx={cloud.cx}
                cy={cloud.cy}
                rx={cloud.rx}
                ry={cloud.ry}
                opacity={cloud.opacity}
              />
            ))}
          </g>
          <rect y="720" width="1440" height="320" className={styles.dayGround} />
        </g>
      </svg>
      <Planet />
    </div>
  );
}
