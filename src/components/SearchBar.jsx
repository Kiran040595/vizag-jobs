const SearchBar = ({ onSearch, searchTerm, totalResults }) => {
  const handleChange = (e) => {
    onSearch(e.target.value);
  };

  return (
    <section className="search-panel">
      <label htmlFor="job-search" className="search-panel__label">
        Search by title or company
      </label>
      <div className="search-panel__input-wrap">
        <span className="search-panel__icon" aria-hidden="true">⌕</span>
        <input
          id="job-search"
          type="text"
          placeholder="Try: Data Analyst, Tech Solutions..."
          onChange={handleChange}
          value={searchTerm}
          className="search-panel__input"
        />
      </div>
      <p className="search-panel__count">{totalResults} jobs match your search</p>
    </section>
  );
};

export default SearchBar;