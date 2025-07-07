
import styles from '../styles/SkeletonLoader.module.css';

export const SkeletonLoader = ({ type = 'default', count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'table':
        return (
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={styles.headerSkeleton}></div>
              ))}
            </div>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className={styles.tableRow}>
                {Array.from({ length: 6 }, (_, j) => (
                  <div key={j} className={styles.cellSkeleton}></div>
                ))}
              </div>
            ))}
          </div>
        );
      
      case 'stats':
        return (
          <div className={styles.statsContainer}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.statTitle}></div>
                <div className={styles.statNumber}></div>
              </div>
            ))}
          </div>
        );
      
      case 'userDetails':
        return (
          <div className={styles.userDetailsContainer}>
            <div className={styles.userHeader}>
              <div className={styles.userTitle}></div>
              <div className={styles.userSubtitle}></div>
            </div>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className={styles.detailRow}>
                <div className={styles.detailLabel}></div>
                <div className={styles.detailValue}></div>
              </div>
            ))}
          </div>
        );
      
      default:
        return (
          <div className={styles.defaultContainer}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className={styles.defaultSkeleton}></div>
            ))}
          </div>
        );
    }
  };

  return <div className={styles.skeletonWrapper}>{renderSkeleton()}</div>;
};

export default SkeletonLoader;
