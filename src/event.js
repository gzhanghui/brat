import $ from 'jquery';
import Util from './util';
import get from 'lodash/get';
import { highlightRounding } from './constants/options';
import { autoPlacement, computePosition, flip, offset, shift } from '@floating-ui/dom';
import './index.scss';
const message = {
  info(){},
  success(){}
}

let arcDragOrigin = null;
let selectedFragment = null;
let dragStartedAt = null;
let arcDragOriginGroup = null;
let arcDragOriginBox = null;
let arcOptions = null;
let selRect = null;
let lastStartRec = null;
let lastEndRec = null;
let arcDragArc = null;
let spanOptions = null;
let reselectedSpan = null;


let svgPosition = 0;
let arcDragJustStarted = false;

const draggedArcHeight = 30;
let highlight, highlightArcs, highlightSpans;


function behaviors(Brat) {
  $.extend(Brat.prototype, {
    bindEvent() {
      $(document.getElementById('svg'))
        .on('mousedown', this.onMouseDown.bind(this))
        .on('mousemove', this.onMouseMove.bind(this))
        .on('dragstart', this.preventDefault.bind(this))
        .on('mouseup', this.onMouseUp.bind(this))
        .on('mouseover', this.onMouseOver.bind(this))
        .on('mouseout', this.onMouseOut.bind(this));
    },
    onMouseDown: function(e) {
      dragStartedAt = e;
      if (arcDragOrigin) return;
      const id = $(e.target).attr('data-span-id');
      if (id) {
        arcOptions = null;
        this.startArcDrag(id);
        return false;
      }
    },
    onMouseMove: function(e) {
      if (arcDragOrigin) {
        if (arcDragJustStarted) {
          // show the possible targets
          const span = this.data.spans[arcDragOrigin] || {};
          const spanDesc = this.spanTypes[span.type] || {};

          const noNumArcType = this.stripNumericSuffix(get(arcOptions, 'type'));
          console.log(this.spanTypes, noNumArcType);
          let $targets = $();
          $.each(spanDesc.arcs || [], (index, item) => {
            if ((arcOptions && item.type === noNumArcType) || !(arcOptions && arcOptions.old_target)) {
              $.each(item.targets || [], (i, target) => {
                $targets = $targets.add(this.svgElement[0].getElementsByClassName('span_' + target));
              });
            }
          });
          $targets.not('[data-span-id="' + arcDragOrigin + '"]').addClass('reselectTarget');
        }
        this.clearSelection();
        const mx = e.pageX - svgPosition.left;
        const my = e.pageY - svgPosition.top + 5;
        const y = Math.min(arcDragOriginBox.y, my) - draggedArcHeight;
        const dx = (arcDragOriginBox.center - mx) / 4;
        const path = this.draw.path().M(arcDragOriginBox.center, arcDragOriginBox.y).curveC(arcDragOriginBox.center - dx, y,
          mx + dx, y,
          mx, my);
        arcDragArc.attr('d', path._path);
        this.floating(e, 1);
      } else {
        const sel = window.getSelection();
        let chunkIndexFrom = sel.anchorNode && $(sel.anchorNode.parentNode).attr('data-chunk-id');
        let chunkIndexTo = sel.focusNode && $(sel.focusNode.parentNode).attr('data-chunk-id');

        let anchorOffset = null;
        let focusOffset = null;
        if (chunkIndexFrom === undefined && chunkIndexTo === undefined &&
          $(sel.anchorNode).attr('data-chunk-id') &&
          $(sel.focusNode).attr('data-chunk-id')) {
          const range = sel.getRangeAt(0);
          const svgOffset = this.svgElement.offset();
          let flip = false;
          let tries = 0;
          let startsAt;
          let sp;
          // First try and match the start offset with a position, if not try it against the other end
          while (tries < 2) {
            sp = this.svg._svg.createSVGPoint();
            sp.x = (flip ? e.pageX : dragStartedAt.pageX) - svgOffset.left;
            sp.y = (flip ? e.pageY : dragStartedAt.pageY) - (svgOffset.top + 8);
            startsAt = range.startContainer;
            anchorOffset = startsAt.getCharNumAtPosition(sp);
            chunkIndexFrom = startsAt && $(startsAt).attr('data-chunk-id');
            if (anchorOffset !== -1) {
              break;
            }
            flip = true;
            tries++;
          }

          // Now grab the end offset
          sp.x = (flip ? dragStartedAt.pageX : e.pageX) - svgOffset.left;
          sp.y = (flip ? dragStartedAt.pageY : e.pageY) - (svgOffset.top + 8);
          const endsAt = range.endContainer;
          focusOffset = endsAt.getCharNumAtPosition(sp);

          // If we cannot get a start and end offset stop here
          if (anchorOffset === -1 || focusOffset === -1) {
            return;
          }
          if (range.startContainer === range.endContainer && anchorOffset > focusOffset) {
            const t = anchorOffset;
            anchorOffset = focusOffset;
            focusOffset = t;
          }

          const startRec = startsAt.getExtentOfChar(anchorOffset);
          startRec.y += 2;
          const endRec = endsAt.getExtentOfChar(focusOffset);
          endRec.y += 2;

          // If nothing has changed then stop here
          if (lastStartRec !== null && lastStartRec.x === startRec.x && lastStartRec.y === startRec.y && lastEndRec !== null && lastEndRec.x === endRec.x && lastEndRec.y === endRec.y) {
            return;
          }

          if (selRect === null) {
            let rx = startRec.x;
            let ry = startRec.y;
            let rw = (endRec.x + endRec.width) - startRec.x;
            if (rw < 0) {
              rx += rw;
              rw = -rw;
            }
            const rh = Math.max(startRec.height, endRec.height);
            selRect = [];
            const activeSelRect = this.makeSelRect(rx, ry, rw, rh);
            selRect.push(activeSelRect);
            startsAt.parentNode.parentNode.parentNode.insertBefore(activeSelRect, startsAt.parentNode.parentNode);
          } else {

            if (startRec.x !== lastStartRec.x && endRec.x !== lastEndRec.x && (startRec.y !== lastStartRec.y || endRec.y !== lastEndRec.y)) {
              if (startRec.y < lastStartRec.y) {
                selRect[0].setAttributeNS(null, 'width', lastStartRec.width);
                lastEndRec = lastStartRec;
              } else if (endRec.y > lastEndRec.y) {
                selRect[selRect.length - 1].setAttributeNS(null, 'x',
                  parseFloat(selRect[selRect.length - 1].getAttributeNS(null, 'x'))
                  + parseFloat(selRect[selRect.length - 1].getAttributeNS(null, 'width'))
                  - lastEndRec.width + '');
                selRect[selRect.length - 1].setAttributeNS(null, 'width', 0 + '');
                lastStartRec = lastEndRec;
              }
            }

            const flip = !(startRec.x === lastStartRec.x && startRec.y === lastStartRec.y);
            if (((endRec.y !== lastEndRec.y)) || ((startRec.y !== lastStartRec.y))) {
              let ss = 0;
              for (; ss !== selRect.length; ss++) {
                if (startRec.y <= parseFloat(selRect[ss].getAttributeNS(null, 'y'))) {
                  break;
                }
              }
              // Next check for any end highlights if we are moving towards the start on a different line
              let es = selRect.length - 1;
              for (; es !== -1; es--) {
                if (endRec.y >= parseFloat(selRect[es].getAttributeNS(null, 'y'))) {
                  break;
                }
              }
              let trunc = false;
              if (ss < selRect.length) {
                for (let s2 = 0; s2 !== ss; s2++) {
                  selRect[s2].parentNode.removeChild(selRect[s2]);
                  es--;
                  trunc = true;
                }
                selRect = selRect.slice(ss);
              }
              if (es > -1) {
                for (let s2 = selRect.length - 1; s2 !== es; s2--) {
                  selRect[s2].parentNode.removeChild(selRect[s2]);
                  trunc = true;
                }
                selRect = selRect.slice(0, es + 1);
              }

              if (trunc) {
                const activeSelRect = flip ? selRect[0] : selRect[selRect.length - 1];
                if (flip) {
                  let rw;
                  if (startRec.y === endRec.y) {
                    rw = (endRec.x + endRec.width) - startRec.x;
                  } else {
                    rw = (parseFloat(activeSelRect.getAttributeNS(null, 'x'))
                        + parseFloat(activeSelRect.getAttributeNS(null, 'width')))
                      - startRec.x;
                  }
                  activeSelRect.setAttributeNS(null, 'x', startRec.x + '');
                  activeSelRect.setAttributeNS(null, 'y', startRec.y + '');
                  activeSelRect.setAttributeNS(null, 'width', rw);
                } else {
                  const rw = (endRec.x + endRec.width) - parseFloat(activeSelRect.getAttributeNS(null, 'x'));
                  activeSelRect.setAttributeNS(null, 'width', rw + '');
                }
              } else {
                const lastSel = flip ? selRect[0] : selRect[selRect.length - 1];
                const startBox = startsAt.parentNode.getBBox();
                const endBox = endsAt.parentNode.getBBox();

                if (flip) {
                  lastSel.setAttributeNS(null, 'width',
                    (parseFloat(lastSel.getAttributeNS(null, 'x'))
                      + parseFloat(lastSel.getAttributeNS(null, 'width')))
                    - endBox.x + '');
                  lastSel.setAttributeNS(null, 'x', endBox.x);
                } else {
                  lastSel.setAttributeNS(null, 'width',
                    (startBox.x + startBox.width) - parseFloat(lastSel.getAttributeNS(null, 'x')) + '');
                }
                let rx;
                let ry;
                let rw;
                let rh;
                if (flip) {
                  rx = startRec.x;
                  ry = startRec.y;
                  rw = this.svgElement.width() - startRec.x;
                  rh = startRec.height;
                } else {
                  rx = endBox.x;
                  ry = endRec.y;
                  rw = (endRec.x + endRec.width) - endBox.x;
                  rh = endRec.height;
                }
                const newRect = this.makeSelRect(rx, ry, rw, rh);
                if (flip) {
                  selRect.unshift(newRect);
                } else {
                  selRect.push(newRect);
                }

                // Place new highlight in appropriate slot in SVG graph
                startsAt.parentNode.parentNode.parentNode.insertBefore(newRect, startsAt.parentNode.parentNode);
              }
            } else {
              // The user simply moved left or right along the same line so just adjust the current highlight
              const activeSelRect = flip ? selRect[0] : selRect[selRect.length - 1];
              // If the start moved shift the highlight and adjust width
              if (flip) {
                const rw = (parseFloat(activeSelRect.getAttributeNS(null, 'x'))
                    + parseFloat(activeSelRect.getAttributeNS(null, 'width')))
                  - startRec.x;
                activeSelRect.setAttributeNS(null, 'x', startRec.x + '');
                activeSelRect.setAttributeNS(null, 'y', startRec.y + '');
                activeSelRect.setAttributeNS(null, 'width', rw + '');
              } else {
                // If the end moved then simple change the width
                const rw = (endRec.x + endRec.width)
                  - parseFloat(activeSelRect.getAttributeNS(null, 'x'));
                activeSelRect.setAttributeNS(null, 'width', rw + '');
              }
            }
          }
          lastStartRec = startRec;
          lastEndRec = endRec;
        }
      }
      arcDragJustStarted = false;
    },
    onMouseUp: function(event) {
      const target = $(event.target);
      const targetSpanId = target.data('span-id');
      const targetChunkId = target.data('chunk-id');
      const targetArcRole = target.data('arc-role');
      if (!(targetSpanId !== undefined || targetChunkId !== undefined || targetArcRole !== undefined)) {
        this.clearSelection();
        this.stopArcDrag(target);
        return;
      }

      // is it arc drag end?
      if (arcDragOrigin) {
        const origin = arcDragOrigin;
        const targetValid = target.hasClass('reselectTarget');
        this.stopArcDrag(target);
        const id = target.attr('data-span-id');
        if (id && origin !== id && targetValid) {
          // const originSpan = this.data.spans[origin];
          const targetSpan = this.data.spans[id];
          if (arcOptions && arcOptions.old_target) {
            arcOptions.target = targetSpan.id;
            message.info('ajax----edited');
          } else {
            message.success('createArc ,', 0);
          }
        }
      } else if (!event.ctrlKey) {
        // if not, then is it span selection? (ctrl key cancels)
        const sel = window.getSelection();
        let chunkIndexFrom = sel.anchorNode && $(sel.anchorNode.parentNode).attr('data-chunk-id');
        let chunkIndexTo = sel.focusNode && $(sel.focusNode.parentNode).attr('data-chunk-id');
        let anchorOffset = null;
        let focusOffset;
        if (chunkIndexFrom === undefined && chunkIndexTo === undefined &&
          $(sel.anchorNode).attr('data-chunk-id') &&
          $(sel.focusNode).attr('data-chunk-id')) {

          const range = sel.getRangeAt(0);
          const svgOffset = this.svgElement.offset();
          let flip = false;
          let tries = 0;
          let sp;
          while (tries < 2) {
            sp = this.svg._svg.createSVGPoint();
            sp.x = (flip ? event.pageX : dragStartedAt.pageX) - svgOffset.left;
            sp.y = (flip ? event.pageY : dragStartedAt.pageY) - (svgOffset.top + 8);
            const startsAt = range.startContainer;
            anchorOffset = startsAt.getCharNumAtPosition(sp);
            chunkIndexFrom = startsAt && $(startsAt).attr('data-chunk-id');
            if (anchorOffset !== -1) {
              break;
            }
            flip = true;
            tries++;
          }
          sp.x = (flip ? dragStartedAt.pageX : event.pageX) - svgOffset.left;
          sp.y = (flip ? dragStartedAt.pageY : event.pageY) - (svgOffset.top + 8);
          const endsAt = range.endContainer;
          focusOffset = endsAt.getCharNumAtPosition(sp);
          if (range.startContainer === range.endContainer && anchorOffset > focusOffset) {
            const t = anchorOffset;
            anchorOffset = focusOffset;
            focusOffset = t;
          }
          if (focusOffset !== -1) {
            focusOffset++;
          }
          chunkIndexTo = endsAt && $(endsAt).attr('data-chunk-id');
        } else {
          // normal case, assume the exact offsets are usable
          anchorOffset = sel.anchorOffset;
          focusOffset = sel.focusOffset;
        }

        if (chunkIndexFrom !== undefined && chunkIndexTo !== undefined) {
          const chunkFrom = this.data.chunks[chunkIndexFrom];
          const chunkTo = this.data.chunks[chunkIndexTo];
          let selectedFrom = chunkFrom.from + anchorOffset;
          let selectedTo = chunkTo.from + focusOffset;
          sel.removeAllRanges();

          if (selectedFrom > selectedTo) {
            const tmp = selectedFrom;
            selectedFrom = selectedTo;
            selectedTo = tmp;
          }
          // trim
          while (selectedFrom < selectedTo && ' \n\t'.indexOf(this.data.text.substr(selectedFrom, 1)) !== -1) selectedFrom++;
          while (selectedFrom < selectedTo && ' \n\t'.indexOf(this.data.text.substr(selectedTo - 1, 1)) !== -1) selectedTo--;

          // shift+click allows zero-width spans
          if (selectedFrom === selectedTo && !event.shiftKey) {
            // simple click (zero-width span)
            return;
          }

          const newOffset = [selectedFrom, selectedTo];
          if (reselectedSpan) {
            const newOffsets = reselectedSpan.offsets.slice(0); // clone
            spanOptions.old_offsets = JSON.stringify(reselectedSpan.offsets);
            if (selectedFragment !== null) {
              if (selectedFragment !== false) {
                newOffsets.splice(selectedFragment, 1);
              }
              newOffsets.push(newOffset);
              newOffsets.sort(Util.cmpArrayOnFirstElement);
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
            message.info(`        fillSpanTypesAndDisplayForm(event, spanText, reselectedSpan);\n
        ${spanText}
         ${reselectedSpan}`).then();
          } else {
            const spanText = this.data.text.substring(selectedFrom, selectedTo);
            message.info(`suggestSpanTypes ${spanText}`);
          }
        }
      }
    },
    onMouseOver: function(event) {
      const target = $(event.target);
      let id = target.attr('data-span-id');
      if (id) {
        const span = this.data.spans[id];
        console.log(span);
        // message.info('dispatcher.post(\'displaySpanComment\')');
        $('#floating').stop().delay(800).fadeIn(200);
        const spanDesc = this.spanTypes[span.type];
        const bgColor = get(spanDesc, 'bgColor', get(this.spanTypes, 'SPAN_DEFAULT.bgColor', '#ffffff'));
        console.log(bgColor);
        highlight = [];
        span.fragments.forEach((frag) => {
          highlight.push(this.highlightGroup.rect(
            frag.highlightPos.w, frag.highlightPos.h).attr({
            x: frag.highlightPos.x,
            y: frag.highlightPos.y,
            'fill': bgColor, opacity: 0.75,
            rx: highlightRounding.x,
            ry: highlightRounding.y,
          }));
        });

        if (arcDragOrigin) {
          target.parent().addClass('highlight');
        } else {
          highlightArcs = this.svgElement.find('g[data-from="' + id + '"], g[data-to="' + id + '"]').addClass('highlight');
          const spans = {};
          spans[id] = true;
          const spanIds = [];
          $.each(span.incoming, function(arcNo, arc) {
            spans[arc.origin] = true;
          });
          $.each(span.outgoing, function(arcNo, arc) {
            spans[arc.target] = true;
          });
          $.each(spans, function(spanId) {
            spanIds.push('rect[data-span-id="' + spanId + '"]');
          });
          highlightSpans = this.svgElement.find(spanIds.join(', ')).parent().addClass('highlight');
        }
        this.forceRedraw();
      } else if (!arcDragOrigin && target.attr('data-arc-role')) {
        const originSpanId = target.attr('data-arc-origin');
        const targetSpanId = target.attr('data-arc-target');
        // NOTE: no commentText, commentType for now
        const arcEventDescId = target.attr('data-arc-ed');
        let commentText = '';
        let commentType = '';
        if (arcEventDescId) {
          const eventDesc = this.data.eventDescs[arcEventDescId];
          const comment = eventDesc.comment;
          if (comment) {
            commentText = comment.text;
            commentType = comment.type;
            if (commentText === '' && commentType) {
              // commentText = commentType;
            }
          }
          if (eventDesc.relation) {
            // arcId = arcEventDescId;
          }
        }
        message.info(`dispatcher.post('displayArcComment')`);
        highlightArcs = this.svgElement.find('g[data-from="' + originSpanId + '"][data-to="' + targetSpanId + '"]').addClass('highlight');
        highlightSpans = this.svgElement.find('rect[data-span-id="' + originSpanId + '"], rect[data-span-id="' + targetSpanId + '"]').parent().addClass('highlight');
      } else if (target.attr('data-sent')) {
        const comment = this.data.sentComment[id];
        if (comment) {
          message.info(`dispatcher.post('displaySentComment', [event, target, comment.text, comment.type])`);
        }
      }
    },
    onMouseOut: function(event) {
      const target = $(event.target);
      target.removeClass('badTarget');
      $('#floating').stop().fadeOut(200);
      // message.info(`dispatcher.post('hideComment')`);
      if (highlight) {
        highlight.forEach(item => {
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
    startArcDrag: function(originId) {
      this.clearSelection();
      this.svgElement.addClass('unselectable');
      svgPosition = this.svgElement.offset();
      arcDragOrigin = originId;
      arcDragArc = this.draw.path().attr({
        markerEnd: 'url(#drag_arrow)',
        'class': 'drag_stroke',
        fill: 'none',
      });
      arcDragOriginGroup = $(this.data.spans[arcDragOrigin].group);
      arcDragOriginGroup.addClass('highlight');
      arcDragOriginBox = Util.realBBox(this.data.chunks, this.data.spans[arcDragOrigin].headFragment);
      arcDragOriginBox.center = arcDragOriginBox.x + arcDragOriginBox.width / 2;
      arcDragJustStarted = true;
    },
    stopArcDrag: function(target) {
      if (arcDragOrigin) {
        if (!target) {
          target = $('.badTarget');
        }
        target.removeClass('badTarget');
        arcDragOriginGroup.removeClass('highlight');
        if (target) {
          target.parent().removeClass('highlight');
        }
        if (arcDragArc) {
          arcDragArc.remove();
        }
        arcDragOrigin = null;
        if (arcOptions) {
          $('g[data-from="' + arcOptions.origin + '"][data-to="' + arcOptions.target + '"]').removeClass('reselect');
        }
        this.svgElement.removeClass('reselect');
      }
      this.svgElement.removeClass('unselectable');
      $('.reselectTarget').removeClass('reselectTarget');
    },
    forceRedraw: function() {
      // svg.css('margin-bottom', 1);
      // setTimeout(function() { svg.css('margin-bottom', 0); }, 0);
    },
    clearSelection: function() {
      window.getSelection().removeAllRanges();
      if (selRect !== null) {
        for (let s = 0; s !== selRect.length; s++) {
          selRect[s].parentNode.removeChild(selRect[s]);
        }
        selRect = null;
        lastStartRec = null;
        lastEndRec = null;
      }
    },
    stripNumericSuffix: function(s) {
      if (typeof (s) !== 'string') {
        return s;
      }
      const m = s.match(/^(.*?)(\d*)$/);
      return m[1];
    },
    makeSelRect: function(rx, ry, rw, rh, col) {
      const selRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      selRect.setAttributeNS(null, 'width', rw);
      selRect.setAttributeNS(null, 'height', rh);
      selRect.setAttributeNS(null, 'x', rx);
      selRect.setAttributeNS(null, 'y', ry);
      selRect.setAttributeNS(null, 'fill', col === undefined ? 'lightblue' : col);
      return selRect;
    },
    createAlert: function() {
      const html = `<div style="display: none" id="floating" class="nusp-alert nusp-alert-warning">
            <div class="nusp-alert-title">
              <span class="nusp-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
              <div class="nusp-alert-message">提示</div>
            </div>
            <div class="nusp-alert-content">
              <div class="nusp-alert-description"></div>
            </div>
          </div>`;
      $('body').append(html);
    },
    floating: function(e, dragId) {
      try {
        const spanId = e.target.getAttribute('data-span-id');
        if (spanId !== null && spanId !== dragId) {
          const { clientX, clientY } = e;
          const tooltip = $('#floating').get(0);
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
            middleware: [offset(5), flip(), shift(), autoPlacement()],
          }).then(({ x, y }) => {
            Object.assign(tooltip.style, { top: `${y}px`, left: `${x}px` });
          });
        }
      } catch (e) {
        console.log(e);
      }
    },
    preventDefault: function(e) {
      e.preventDefault();
    },
  });

}

export default behaviors;

