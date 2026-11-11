/* Gabarit des leçons CI/CD : comme String.raw, mais on écrit \${{ … }} dans le source
   (sinon JavaScript lirait ${ … } comme une interpolation) et le texte final contient ${{ … }}. */
export const Y = (s, ...v) => String.raw(s, ...v).replace(/\\\$\{\{/g, "${{");
