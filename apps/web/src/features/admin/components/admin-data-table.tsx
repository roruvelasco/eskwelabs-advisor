'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ArrowDown,
  ArrowUp
} from 'lucide-react';

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@eskwelabs-advisor/ui';

import { cn } from '@/lib/utils';

interface AdminDataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  enableSorting?: boolean;
  enablePagination?: boolean;
  enableFiltering?: boolean;
  filterPlaceholder?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  loadingRows?: number;
  loadingColumns?: number;
}

export function AdminDataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data found.',
  enableSorting = true,
  enablePagination = true,
  enableFiltering = false,
  filterPlaceholder = 'Search...',
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  loadingRows = 4,
  loadingColumns
}: AdminDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: enableFiltering ? globalFilter : undefined
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    initialState: {
      pagination: { pageSize }
    }
  });

  const colCount = loadingColumns ?? columns.length;

  return (
    <div className="space-y-3">
      {enableFiltering && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6">
          <Input
            placeholder={filterPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const canSort = enableSorting && header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  const isFirst = index === 0;
                  const isLast = index === headerGroup.headers.length - 1;

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        canSort && 'cursor-pointer select-none',
                        isFirst && 'pl-6',
                        isLast && 'pr-6'
                      )}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {canSort && <SortIcon direction={sortDir} />}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: colCount }).map((__, colIndex) => {
                    const isFirst = colIndex === 0;
                    const isLast = colIndex === colCount - 1;
                    return (
                      <TableCell
                        key={colIndex}
                        className={cn(
                          'py-4',
                          isFirst && 'pl-6',
                          isLast && 'pr-6'
                        )}
                      >
                        <Skeleton className="h-5 w-full max-w-32" />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-[260px] text-center"
                >
                  <p className="text-muted-foreground text-sm">
                    {emptyMessage}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirst = index === 0;
                    const isLast = index === row.getVisibleCells().length - 1;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'py-4',
                          isFirst && 'pl-6',
                          isLast && 'pr-6'
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && !isLoading && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-4 sm:px-6">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span>
              {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span>{table.getFilteredRowModel().rows.length} rows</span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc')
    return <ArrowUp className="text-foreground size-3 shrink-0" />;
  if (direction === 'desc')
    return <ArrowDown className="text-foreground size-3 shrink-0" />;
  return (
    <ChevronsUpDown className="text-muted-foreground/40 size-3 shrink-0" />
  );
}
