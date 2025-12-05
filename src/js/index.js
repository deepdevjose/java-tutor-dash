/**
 * Inicializa la animación secuencial de los elementos de la Hero Page.
 * Añade la clase 'visible' a cada elemento con un retraso progresivo para crear efecto de entrada.
 *
 * @file index.js
 */
document.addEventListener('DOMContentLoaded', () => {

    /**
     * Elementos que serán animados en la Hero Page.
     * @type {Array<HTMLElement|null>}
     */
    const elementsToAnimate = [
        document.querySelector('.logo'),
        document.querySelector('.hero-nav .btn-secondary'),
        document.getElementById('hero-title'),
        document.querySelector('.title-divider'),
        document.getElementById('hero-subtitle'),
        document.getElementById('hero-button')
    ];

    /**
     * Tiempo inicial de retraso para la animación (en milisegundos).
     * @type {number}
     */
    let delay = 300;

    // Animamos cada elemento con un retraso incremental para lograr el efecto "staggered".
    elementsToAnimate.forEach((element) => {
        if (element) {
            setTimeout(() => {
                element.classList.add('visible');
            }, delay);

            // Incrementamos el retraso para el siguiente elemento (efecto cascada)
            delay += 200;
        }
    });

});