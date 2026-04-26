const Header = ({ totalJobs }) => {
  return (
    <header className="hero-header">
      <div className="hero-header__content">
        <p className="hero-header__eyebrow">Vizag's local job board</p>
        <h1>Find better opportunities in Visakhapatnam</h1>
        <p className="hero-header__subtitle">
          Discover verified roles across tech, analytics, design, and management.
        </p>
        <div className="hero-header__meta">
          <span>{totalJobs} active openings</span>
          <span>Updated daily</span>
        </div>
      </div>
    </header>
  );
};

export default Header;