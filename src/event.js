import Util from './util';
import { highlightRounding } from './constants/options';
import './assets/index.scss';
import { flatten, extend, get, sortBy } from 'lodash';
import Popper from './util/popper';
import { Path } from '@svgdotjs/svg.js';

const message = {
  info() {},
  success() {},
};

let selectedFragment = null;
let arcDragOriginBox = null;
let selRect = null;
let lastStartRec = null;
let lastEndRec = null;
let arcDragArc = null;
let spanOptions = null;
let reselectedSpan = null;

const draggedArcHeight = 30;
let highlight, highlightArcs, highlightSpans;

function behaviors(Brat) {
  extend(Brat.prototype, {
    bindEvent() {
      this.floating = new Popper();
      this.draw
        .on('mouseover', this.onMouseOver.bind(this))
        .on('mousedown', this.onMouseDown.bind(this))
        .on('mousemove', this.onMouseMove.bind(this))
        .on('dragstart', this.preventDefault.bind(this))
        .on('mouseup', this.onMouseUp.bind(this))
        .on('mouseout', this.onMouseOut.bind(this));
    },
    onMouseDown: function (e) {
      if (this.arcDragOrigin) return;
      const id = e.target.instance.attr('data-span-id');
      if (id) {
        this.arcOptions = null;
        this.clearSelection();
        this.draw.addClass('user-select-none');
        this.boundingClientRect = this.draw.node.getBoundingClientRect();
        this.arcDragOrigin = id;
        arcDragArc = this.draw.path().attr({
          markerEnd: 'url(#drag_arrow)',
          class: 'drag_stroke',
          fill: 'none',
        });
        arcDragOriginBox = Util.realBBox(this.data.chunks, this.data.spans[this.arcDragOrigin].headFragment);
        arcDragOriginBox.center = arcDragOriginBox.x + arcDragOriginBox.width / 2;
        this.arcDragJustStarted = true;
        return false;
      }
    },
    onMouseMove: function (e) {
      if (this.arcDragOrigin) {
        if (this.arcDragJustStarted) {
          const span = this.data.spans[this.arcDragOrigin] || {};
          const spanDesc = this.spanTypes[span.type] || {};
          const noNumArcType = this.stripNumericSuffix(get(this.arcOptions, 'type'));
          const targets = [];
          get(spanDesc, 'arcs', []).forEach((item) => {
            if ((this.arcOptions && item.type === noNumArcType) || !this.arcOptions) {
              get(item, 'targets', []).forEach((target) => {
                targets.push(this.draw.find('.span_' + target));
              });
            }
          });
          flatten(targets).forEach((element) => {
            if (element.attr('data-span-id') !== this.arcDragOrigin) {
              element.addClass('reselectTarget');
            }
          });
        }
        this.clearSelection();
        const mx = e.pageX - this.boundingClientRect.left;
        const my = e.pageY - this.boundingClientRect.top + 5;
        const y = Math.min(arcDragOriginBox.y, my) - draggedArcHeight;
        const dx = (arcDragOriginBox.center - mx) / 4;
        const path = this.draw.path();
        if (path instanceof Path) {
          path.M(arcDragOriginBox.center, arcDragOriginBox.y).curveC(arcDragOriginBox.center - dx, y, mx + dx, y, mx, my);
          arcDragArc.attr('d', path._path);
        }

        this.floating.computePosition(e);
      } else {
        const selection = window.getSelection();
        if (!selection.toString()) return;
        const anchorTspan = get(selection, 'anchorNode.parentNode');
        const focusTspan = get(selection, 'focusNode.parentNode');
        let chunkIndexFrom = anchorTspan ? anchorTspan.getAttribute('data-chunk-id') : void 0;
        let chunkIndexTo = focusTspan ? focusTspan.getAttribute('data-chunk-id') : void 0;
        console.log(chunkIndexFrom, chunkIndexTo);
      }
      this.arcDragJustStarted = false;
    },
    onMouseUp: function (event) {
      const target = event.target.instance;
      const targetSpanId = target.data('span-id');
      const targetChunkId = target.data('chunk-id');
      const targetArcRole = target.data('arc-role');
      if ([targetSpanId, targetChunkId, targetArcRole].every((n) => n === undefined)) {
        this.clearSelection();
        this.stopArcDrag(event.target.instance);
        return;
      }

      // is it arc drag end?
      if (this.arcDragOrigin) {
        const origin = this.arcDragOrigin;
        const targetValid = target.hasClass('reselectTarget');
        this.stopArcDrag(event.target.instance);
        const id = target.attr('data-span-id');
        if (id && origin !== id && targetValid) {
          // const originSpan = this.data.spans[origin];
          const targetSpan = this.data.spans[id];
          if (this.arcOptions) {
            this.arcOptions.target = targetSpan.id;
            message.info('ajax----edited');
          } else {
            message.success('createArc ,', 0);
          }
        }
      } else if (!event.ctrlKey) {
        const selection = window.getSelection();
        if (!selection.toString()) return;
        const anchorTspan = get(selection, 'anchorNode.parentNode');
        const focusTspan = get(selection, 'focusNode.parentNode');
        let chunkIndexFrom = anchorTspan ? anchorTspan.getAttribute('data-chunk-id') : void 0;
        let chunkIndexTo = focusTspan ? focusTspan.getAttribute('data-chunk-id') : void 0;
        // if not, then is it span selection? (ctrl key cancels)
        let anchorOffset = selection.anchorOffset;
        let focusOffset = selection.focusOffset;

        if (chunkIndexFrom !== undefined && chunkIndexTo !== undefined) {
          const chunkFrom = this.data.chunks[chunkIndexFrom];
          const chunkTo = this.data.chunks[chunkIndexTo];
          let selectedFrom = chunkFrom.from + anchorOffset;
          let selectedTo = chunkTo.from + focusOffset;
          selection.removeAllRanges();

          if (selectedFrom > selectedTo) {
            const tmp = selectedFrom;
            selectedFrom = selectedTo;
            selectedTo = tmp;
          }
          while (selectedFrom < selectedTo && ' \n\t'.indexOf(this.data.text.substring(selectedFrom, selectedFrom + 1)) !== -1) {
            selectedFrom++;
          }
          while (selectedFrom < selectedTo && ' \n\t'.indexOf(this.data.text.substring(selectedTo - 1, selectedTo)) !== -1) {
            selectedTo--;
          }
          // shift+click allows zero-width spans
          if (selectedFrom === selectedTo && !event.shiftKey) {
            // simple click (zero-width span)
            return;
          }

          const newOffset = [selectedFrom, selectedTo];
          if (reselectedSpan) {
            let newOffsets = reselectedSpan.offsets.slice(0); // clone
            spanOptions.old_offsets = JSON.stringify(reselectedSpan.offsets);
            if (selectedFragment !== null) {
              if (selectedFragment !== false) {
                newOffsets.splice(selectedFragment, 1);
              }
              newOffsets.push(newOffset);
              newOffsets = sortBy(newOffsets, (offset) => offset[0]);
              spanOptions.offsets = newOffsets;
            } else {
              spanOptions.offsets = [newOffset];
            }
          } else {
            spanOptions = {
              action: 'createSpan',
              offsets: [newOffset],
            };
          }

          if (!window.Configuration.rapidModeOn || reselectedSpan !== null) {
            const spanText = this.data.text.substring(selectedFrom, selectedTo);
            console.log('fillSpanTypesAndDisplayForm' + spanText);
          } else {
            const spanText = this.data.text.substring(selectedFrom, selectedTo);
            console.log(`suggestSpanTypes ${spanText}`);
          }
        }
      }
    },
    onMouseOver: function (event) {
      const target = event.target.instance;
      console.log(event.target);
      let id = target.attr('data-span-id');
      if (id) {
        const span = this.data.spans[id];
        this.floating.computePosition(event);
        this.floating.fadeIn();
        const spanDesc = this.spanTypes[span.type];
        const bgColor = get(spanDesc, 'bgColor', get(this.spanTypes, 'SPAN_DEFAULT.bgColor', '#ffffff'));
        highlight = [];
        span.fragments.forEach((frag) => {
          highlight.push(
            this.highlightGroup.rect(frag.highlightPos.w, frag.highlightPos.h).attr({
              x: frag.highlightPos.x,
              y: frag.highlightPos.y,
              fill: bgColor,
              opacity: 0.75,
              rx: highlightRounding.x,
              ry: highlightRounding.y,
            }),
          );
        });

        if (this.arcDragOrigin) {
          target.parent().addClass('highlight');
        } else {
          highlightArcs = this.draw.find('g[data-from="' + id + '"], g[data-to="' + id + '"]');
          highlightArcs.forEach((g) => {
            g.addClass('highlight');
          });
          const spans = {};
          spans[id] = true;
          const spanIds = [];
          span.incoming.forEach((arc) => {
            spans[arc.origin] = true;
          });
          span.outgoing.forEach((arc) => {
            spans[arc.target] = true;
          });
          Object.keys(spans).forEach((spanId) => {
            spanIds.push('rect[data-span-id="' + spanId + '"]');
          });
          const g = this.draw.find(spanIds.join(', '));
          g.each((item) => {
            highlightSpans = item.parent().addClass('highlight');
          });
        }
        this.forceRedraw();
      } else if (!this.arcDragOrigin && target.attr('data-arc-role')) {
        //todo
      }
    },
    onMouseOut: function (event) {
      const target = event.target.instance;
      target.removeClass('badTarget');
      this.floating.computePosition(event);
      this.floating.fadeOut();
      if (highlight) {
        highlight.forEach((item) => {
          item.remove();
        });

        highlight = undefined;
      }
      if (highlightSpans) {
        highlightArcs.removeClass('highlight');
        highlightSpans.removeClass('highlight');
        highlightSpans = undefined;
      }
      this.forceRedraw();
    },
    stopArcDrag: function (target) {
      if (this.arcDragOrigin) {
        if (target) {
          target.parent().removeClass('highlight');
        }
        if (arcDragArc) {
          arcDragArc.remove();
        }
        this.arcDragOrigin = null;
        if (this.arcOptions) {
          const selector = `g[data-from="${this.arcOptions.origin}"][data-to="${this.arcOptions.target}"]`;
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => element.classList.remove('reselect'));
        }
        this.draw.removeClass('reselect');
      }
      this.draw.removeClass('unselectable');
      this.draw.find('.reselectTarget').forEach((rect) => rect.removeClass('reselectTarget'));
    },
    forceRedraw: function () {
      // svg.css('margin-bottom', 1);
      // setTimeout(function() { svg.css('margin-bottom', 0); }, 0);
    },
    clearSelection: function () {
      window.getSelection().removeAllRanges();
      if (selRect !== null) {
        for (let s = 0; s !== selRect.length; s++) {
          selRect[s].parentNode.removeChild(selRect[s]);
        }
        selRect = null;
        lastStartRec = null;
        lastEndRec = null;
        console.log(lastStartRec, selRect, lastEndRec);
      }
    },
    stripNumericSuffix: function (s) {
      if (typeof s !== 'string') {
        return s;
      }
      const m = s.match(/^(.*?)(\d*)$/);
      return m[1];
    },
    preventDefault: function (e) {
      e.preventDefault();
    },
  });
}

export default behaviors;
