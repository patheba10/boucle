/* Gabarit des leçons Linux : comme String.raw, mais on écrit \${…} dans le source
   (sinon JavaScript lirait ${…} comme une interpolation) et le texte final contient ${…}. */
export const R = (s, ...v) => String.raw(s, ...v).replace(/\\\$\{/g, "${");

/* Journal d'accès nginx réaliste, partagé par plusieurs exercices. */
export const ACCESS_LOG = [
  ["203.0.113.5", "09:00:01", "GET", "/", 200, 612],
  ["198.51.100.7", "09:00:02", "GET", "/wp-login.php", 404, 162],
  ["203.0.113.5", "09:00:03", "GET", "/api/produits", 200, 1834],
  ["192.0.2.44", "09:00:05", "POST", "/api/commandes", 201, 96],
  ["198.51.100.7", "09:00:06", "GET", "/.env", 404, 162],
  ["203.0.113.5", "09:00:09", "GET", "/api/produits/42", 200, 412],
  ["192.0.2.44", "09:00:12", "GET", "/api/panier", 500, 31],
  ["198.51.100.7", "09:00:13", "GET", "/admin", 404, 162],
  ["203.0.113.80", "09:00:15", "GET", "/", 200, 612],
  ["192.0.2.44", "09:00:18", "POST", "/api/commandes", 500, 31],
  ["203.0.113.5", "09:00:21", "GET", "/api/produits", 200, 1834],
  ["198.51.100.7", "09:00:22", "GET", "/phpmyadmin", 404, 162],
  ["203.0.113.80", "09:00:25", "GET", "/api/produits", 200, 1834],
  ["192.0.2.44", "09:00:31", "GET", "/api/panier", 200, 230],
  ["203.0.113.5", "09:00:40", "GET", "/favicon.ico", 404, 162],
].map(([ip, t, m, p, s, b]) => ip + ' - - [12/Nov/2026:' + t + ' +0000] "' + m + " " + p + ' HTTP/1.1" ' + s + " " + b + ' "-" "Mozilla/5.0"').join("\n") + "\n";
