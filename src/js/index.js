/**
 * @file index.js
 * Lógica para la animación de entrada de la Hero Page.
 */
document.addEventListener('DOMContentLoaded', () => {

    // Seleccionar todos los elementos que animaremos
    const elementsToAnimate = [
        document.querySelector('.logo'),
        document.querySelector('.hero-nav .btn-secondary'),
        document.getElementById('hero-title'),
        document.querySelector('.title-divider'),
        document.getElementById('hero-subtitle'),
        document.getElementById('hero-button')
    ];

    // Tiempo de espera base
    let delay = 300; // ms

    // Recorrer cada elemento y añadirle la clase 'visible'
    // con un pequeño retraso (delay) entre cada uno
    elementsToAnimate.forEach((element) => {
        if (element) {
            setTimeout(() => {
                element.classList.add('visible');
            }, delay);

            // Incrementar el retraso para el siguiente elemento
            delay += 200; // 200ms entre cada animación
        }
    });

});