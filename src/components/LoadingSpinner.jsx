const LoadingSpinner = ({ message = "Jobs are loading please wait" }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        {/* Outer ring */}
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-200"></div>
        {/* Inner ring */}
        <div className="absolute left-0 top-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-blue-600"></div>
        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600"></div>
      </div>
      <p className="mt-4 text-center text-sm font-medium text-slate-600 sm:text-base">
        {message}
      </p>
      <div className="mt-2 flex space-x-1">
        <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;