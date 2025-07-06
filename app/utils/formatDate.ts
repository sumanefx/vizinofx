export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-us", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
