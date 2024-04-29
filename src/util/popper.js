import { Element } from '@svgdotjs/svg.js';
import { autoPlacement, computePosition, flip, offset, shift } from '@floating-ui/dom';
import 'animate.css';

const FADEIN = 'animate__fadeIn';
const FADEOUT = 'animate__fadeOut';

class Popper {
  constructor() {
    this.render();
    this.bindEvent();
  }

  bindEvent() {
    this.element.on('mouseover', this.mouseover.bind(this));
    this.element.on('mouseout', this.mouseout.bind(this));
  }

  mouseover(e) {
    console.log(e.target.instance);
  }

  mouseout(e) {
    console.log(e.target.instance);
  }

  fadeIn() {
    this.clearTimeout();
    this._timeout = setTimeout(() => {
      this.element.removeClass(FADEOUT).addClass(FADEIN + ' ');
      this.element.show();
    }, 1000);
  }

  fadeOut() {
    this.clearTimeout();
    if (this.element.hasClass(FADEOUT)) {
      return;
    }
    this.element.removeClass(FADEIN).addClass(FADEOUT);
    this._timeout = setTimeout(() => {
      this.element.hide();
    }, 1000);
  }

  clearTimeout() {
    clearTimeout(this._timeout);
    this._timeout = null;
  }

  computePosition(e) {
    try {
      const { clientX, clientY } = e;
      const tooltip = this.element.node;
      const virtualEl = {
        getBoundingClientRect() {
          return {
            width: 0,
            height: 0,
            x: clientX,
            y: clientY,
            left: clientX,
            right: clientX,
            top: clientY,
            bottom: clientY,
          };
        },
      };
      computePosition(virtualEl, tooltip, {
        placement: 'right-start',
        middleware: [offset(30), flip(), shift(), autoPlacement()],
      }).then(({ x, y }) => {
        Object.assign(tooltip.style, { top: `${y}px`, left: `${x}px` });
      });
    } catch (e) {
      console.log(e);
    }
  }

  render() {
    const element = new Element(document.createElement('div'));
    element.addClass('position-fixed w-80 alert alert-primary animate__animated').attr('id', 'floating');
    element.node.innerHTML = `<div class="nusp-alert-title font-normal flex items-center text-sm">
                 <svg  xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle mr-2" viewBox="0 0 16 16">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"></path>
                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"></path>
                  </svg>
              提示
            </div>
            <div class="nusp-alert-content pt-1 font-normal text-[13px]">
              <div class="nusp-alert-description">在繁华的都市中，我们追逐着梦想，不畏艰难，勇往直前。汗水与努力铺就成功之路，每一次挑战都是成长的契机。让我们携手前行，共创辉煌未来。
          </div>
            </div>`;
    document.body.appendChild(element.node);
    this.element = element;
  }
}

export default Popper;
