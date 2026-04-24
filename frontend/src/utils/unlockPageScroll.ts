export function unlockPageScroll() {
    try {
        const body = document.body as HTMLBodyElement;
        const html = document.documentElement as HTMLElement;

        body.style.overflow = '';
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        body.style.touchAction = '';

        html.style.overflow = '';
        html.style.touchAction = '';
        html.style.removeProperty('overscroll-behavior-y');

        body.classList.remove('MuiModal-open');
        html.classList.remove('MuiModal-open');

        if (body.dataset.appliedIosLock) {
            delete body.dataset.appliedIosLock;
        }
    } catch {
        /* noop */
    }
}

export default unlockPageScroll;