export const getPagination = (query) => {
  const page = Math.max(Number(query.page || 1), 1);
  const requestedPageSize = Math.max(Number(query.pageSize || 20), 1);
  const pageSize = Math.min(requestedPageSize, 60);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
};

export const buildPageMeta = (total, page, pageSize) => ({
  total,
  page,
  pageSize,
  totalPages: Math.max(Math.ceil(total / pageSize), 1)
});
