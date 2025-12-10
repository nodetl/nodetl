import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSize?: boolean;
  showTotalItems?: boolean;
  compact?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSize = true,
  showTotalItems = true,
  compact = false,
  className,
}: PaginationProps) {
  if (totalPages <= 0) return null;

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= Math.min(maxVisible, totalPages - 1); i++) {
          pages.push(i);
        }
        if (totalPages > maxVisible) {
          pages.push('ellipsis');
        }
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push('ellipsis');
        for (let i = totalPages - maxVisible + 1; i < totalPages; i++) {
          if (i > 1) pages.push(i);
        }
      } else {
        // In the middle
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t border-gray-200 dark:border-gray-700",
      compact && "py-2 gap-2",
      className
    )}>
      {/* Left side: Total items and page size */}
      {!compact && (
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          {showTotalItems && totalItems !== undefined && (
            <span>
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </span>
          )}
          
          {showPageSize && onPageSizeChange && (
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="px-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>per page</span>
            </div>
          )}
        </div>
      )}

      {/* Right side: Pagination controls */}
      <div className={cn("flex items-center gap-1", compact && "w-full justify-between")}>
        {/* First page button - hide in compact mode */}
        {!compact && (
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              currentPage === 1
                ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
            )}
            title="First page"
          >
            <ChevronsLeft size={16} />
          </button>
        )}

        {/* Previous page button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            "p-1.5 rounded-lg border transition-colors",
            currentPage === 1
              ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
              : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
          )}
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page numbers - hide in compact mode */}
        {!compact && (
          <div className="flex items-center gap-1 mx-1">
            {pageNumbers.map((page, index) =>
              page === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-gray-400 dark:text-gray-500"
                >
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={cn(
                    "min-w-[32px] h-8 px-2 text-sm rounded-lg transition-colors",
                    currentPage === page
                      ? "bg-blue-600 dark:bg-blue-500 text-white font-medium"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  {page}
                </button>
              )
            )}
          </div>
        )}

        {/* Next page button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            "p-1.5 rounded-lg border transition-colors",
            currentPage === totalPages
              ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
              : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
          )}
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>

        {/* Last page button - hide in compact mode */}
        {!compact && (
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              currentPage === totalPages
                ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
            )}
            title="Last page"
          >
            <ChevronsRight size={16} />
          </button>
        )}

        {/* Page info */}
        <span className={cn("text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap", !compact && "ml-2")}>
          Page {currentPage} of {totalPages}
        </span>
      </div>
    </div>
  );
}
