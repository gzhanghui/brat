import $ from 'jquery';
import chroma from 'chroma-js';
import { Marker } from '@svgdotjs/svg.js';
import { defaultTo, get, isEmpty } from 'lodash';
import { Row } from './class';
import Util from './util';
import * as OPTION from './constants/options';

const Configuration = window.Configuration;

function render(Brat) {
  $.extend(Brat.prototype, {
    renderDataReal: function() {
      const data = this.data;
      if (isEmpty(data)) return;
      this.spanTypes = this.analysisTypes(this.information);
      this.relationTypesHash = this.analysisRelation(this.information);
      this.draw.clear();
      this.createDefs();
      // 创建分组 按顺序
      this.backgroundGroup = this.draw.group().addClass('background');
      this.highlightGroup = this.draw.group().addClass('highlight');
      this.textGroup = this.draw.group().addClass('text');
      this.sentNumGroup = this.draw.group().addClass('sentnum');
      this.canvasWidth = this.svgElement.width();
      const sizes = this.getSizes();
      data.sizes = sizes;
      data.towers = this.adjustFragmentSizes(data);
      let maxTextWidth = Math.max(...Object.values(sizes.texts.widths));
      let currentX = Configuration.visual.margin.x + OPTION.sentNumMargin + OPTION.rowPadding;
      const rows = [];
      const fragmentHeights = [];
      let sentenceToggle = 0;
      let sentenceNumber = 0;
      let row = new Row(this.draw);
      row.sentence = ++sentenceNumber;
      row.backgroundIndex = sentenceToggle;
      row.index = 0;
      let rowIndex = 0;
      const openTextHighlights = {};
      const floors = [];
      let reservations = [];
      // 给 span 添加 floor
      data.order.forEach((id) => {
        const span = data.spans[id];
        this.calcFloorAndReservations(span, floors, reservations, sizes);
      });
      data.chunks.forEach(chunk => {
        reservations = [];
        chunk.group = row.group.group();
        chunk.highlightGroup = chunk.group.group();
        let hasLeftArcs, hasRightArcs, hasInternalArcs, hasAnnotations;
        let y = 0;
        let chunkFrom = Infinity;
        let chunkTo = 0;
        let chunkHeight = 0;
        let spacing = 0;
        let spacingChunkId = null;
        let spacingRowBreak = 0;
        // 文本划线上面的标签
        this.renderFragment(chunk, sizes, y);
        chunk.fragments.forEach(fragment => {
          const span = this.data.spans[fragment.spanId];
          let fragmentHeight = 0;
          const spacedTowerId = fragment.towerId * 2;
          if (!fragmentHeights[spacedTowerId] || fragmentHeights[spacedTowerId] < fragment.height) {
            fragmentHeights[spacedTowerId] = fragment.height;
          }
          if (fragment.drawCurly) {
            chunkFrom = Math.min(fragment.curly.from, chunkFrom);
            chunkTo = Math.max(fragment.curly.to, chunkTo);
            fragmentHeight = Math.max(Configuration.visual.curlyHeight, fragmentHeight);
          }
          fragmentHeight += span.floor || Configuration.visual.curlyHeight;
          if (fragmentHeight > chunkHeight) chunkHeight = fragmentHeight;
          hasAnnotations = true;
        });
        // positioning of the chunk
        chunk.right = chunkTo;
        const textWidth = sizes.texts.widths[chunk.text];
        chunkHeight += sizes.texts.height;
        const boxX = -Math.min(chunkFrom, 0);
        const boxWidth = Math.max(textWidth, chunkTo) - Math.min(0, chunkFrom);
        if (spacing > 0) currentX += spacing;
        const rightBorderForArcs = hasRightArcs ? OPTION.arcHorizontalSpacing : (hasInternalArcs ? OPTION.arcSlant : 0);
        const lastRow = row;
        if (chunk.sentence) {
          while (sentenceNumber < chunk.sentence) {
            sentenceNumber++;
            row.arcs = row.group.group().addClass('arcs');
            rows.push(row);
            row = new Row(this.draw);
            sentenceToggle = 1 - sentenceToggle;
            row.backgroundIndex = sentenceToggle;
            row.index = ++rowIndex;
          }
          sentenceToggle = 1 - sentenceToggle;
        }

        if (chunk.sentence || currentX + boxWidth + rightBorderForArcs >= this.canvasWidth - 2 * Configuration.visual.margin.x) {
          row.arcs = row.group.group().addClass('arcs');
          currentX = Configuration.visual.margin.x + OPTION.sentNumMargin + OPTION.rowPadding + (hasLeftArcs ? OPTION.arcHorizontalSpacing : (hasInternalArcs ? OPTION.arcSlant : 0));
          if (hasLeftArcs) {
            const adjustedCurTextWidth = sizes.texts.widths[chunk.text] + OPTION.arcHorizontalSpacing;
            if (adjustedCurTextWidth > maxTextWidth) {
              maxTextWidth = adjustedCurTextWidth;
            }
          }
          if (spacingRowBreak > 0) {
            currentX += spacingRowBreak;
            spacing = 0; // do not center intervening elements
          }
          rows.push(row);
          chunk.group.remove();
          row = new Row(this.draw);
          row.backgroundIndex = sentenceToggle;
          row.index = ++rowIndex;
          row.group.add(chunk.group);
          chunk.group = row.group.node.lastElementChild;
          $(chunk.group).children('g[class=\'span\']').each(function(index, element) {
            chunk.fragments[index].group = element;
          });
          $(chunk.group).find('rect[data-span-id]').each(function(index, element) {
            chunk.fragments[index].rect = element;
          });
        }
        // break the text highlights when  the row breaks
        if (row.index !== lastRow.index) {
          $.each(openTextHighlights, function(textId, textDesc) {
            textDesc[3] = currentX;
          });
        }
        // XXX check this - is it used? should it be lastRow?
        if (hasAnnotations) row.hasAnnotations = true;
        if (chunk.sentence) {
          row.sentence = ++sentenceNumber;
        }
        if (spacing > 0) {
          // if we added a gap, center the intervening elements
          spacing /= 2;
          const firstChunkInRow = row.chunks[row.chunks.length - 1];
          if (spacingChunkId < firstChunkInRow.index) {
            spacingChunkId = firstChunkInRow.index + 1;
          }
          for (let chunkIndex = spacingChunkId; chunkIndex < chunk.index; chunkIndex++) {
            const movedChunk = data.chunks[chunkIndex];
            this.translate(movedChunk, movedChunk.translation.x + spacing, 0);
            movedChunk.textX += spacing;
          }
        }

        row.chunks.push(chunk);
        chunk.row = row;
        this.translate(chunk, currentX + boxX, 0);

        chunk.textX = currentX + boxX;
        let spaceWidth = 0;
        const spaceLen = chunk.nextSpace && chunk.nextSpace.length || 0;
        for (let i = 0; i < spaceLen; i++) spaceWidth += OPTION.spaceWidths[chunk.nextSpace[i]] || 0;
        currentX += spaceWidth + boxWidth;
      });
      // finish the last row
      row.arcs = row.group.group().addClass('arcs');

      rows.push(row);
      // 预处理 fragmentHeights 数组
      for (let i = 0; i < fragmentHeights.length; i++) {
        if (!fragmentHeights[i] || fragmentHeights[i] < Configuration.visual.arcStartHeight) {
          fragmentHeights[i] = Configuration.visual.arcStartHeight;
        }
      }
      // 排序 arc height
      this.sortArcs(data, fragmentHeights);
      // 箭头
      this.renderArrow();
      // 弧线
      this.renderArc(rows, sizes, fragmentHeights);
      // 背景
      this.renderBackground(rows, sizes);
      // 文本高亮渲染
      this.renderChunkRect(sizes);
      // 文本渲染
      this.renderSentence();
      // 调整 SVG 尺寸
      this.resizeCanvas(maxTextWidth);
    },
    renderBackground: function(rows, sizes) {
      const backgroundGroup = this.backgroundGroup;
      let y = Configuration.visual.margin.y;
      rows.forEach(row => {
        row.chunks.forEach(chunk => {
          chunk.fragments.forEach(fragment => {
            if (row.maxSpanHeight < fragment.height) row.maxSpanHeight = fragment.height;
          });
        });
        let rowBoxHeight = Math.max(row.maxArcHeight + 5, row.maxSpanHeight + 1.5);
        if (row.hasAnnotations) {
          rowBoxHeight += OPTION.rowSpacing + 1.5;
        } else {
          rowBoxHeight -= 5;
        }
        rowBoxHeight += OPTION.rowPadding;
        let bgClass;
        if (Configuration.textBackgrounds === 'striped') {
          bgClass = 'background' + row.backgroundIndex;
        } else {
          bgClass = 'background0';
        }
        // 渲染条纹背景
        backgroundGroup.rect(this.canvasWidth, rowBoxHeight + sizes.texts.height + 1)
          .attr({
            x: 0,
            y: y + sizes.texts.y + sizes.texts.height,
          }).addClass(bgClass);

        y += rowBoxHeight;
        y += sizes.texts.height;
        row.textY = y - OPTION.rowPadding;
        // 渲染行号
        this.renderLineNumber(row, y);
        let rowY = y - OPTION.rowPadding;
        if (OPTION.roundCoordinates) {
          rowY = rowY | 0;
        }
        this.translate(row, 0, rowY);
        y += Configuration.visual.margin.y;
      });
      y += Configuration.visual.margin.y;
      this.canvasHeight = y;
    },
    // 文本段落
    renderSentence() {
      const textGroup = this.textGroup;
      let sentenceText = [];
      this.data.chunks.forEach((chunk, chunkNo) => {
        if (chunk.sentence) {
          if (sentenceText) {
            textGroup.text(add => {
              sentenceText.forEach(item => {
                add.tspan(item.text).attr({
                  x: item.x,
                  y: item.y,
                  'data-chunk-id': item['data-chunk-id'],
                });
              });
            }).attr({ x: 0, y: 0 });
          }
          sentenceText = [];
        }
        if (!sentenceText) {
          sentenceText = [];
        }
        const nextChunk = this.data.chunks[chunkNo + 1];
        const nextSpace = nextChunk ? nextChunk.space : '';
        sentenceText.push({
          text: chunk.text + nextSpace,
          x: chunk.textX,
          y: chunk.row.textY,
          'data-chunk-id': chunk.index,
        });
      });
      if (sentenceText.length) {
        textGroup.text((add) => {
          sentenceText.forEach(item => {
            add.tspan(item.text).attr({
              x: item.x,
              y: item.y,
              'data-chunk-id': item['data-chunk-id'],
            });
          });
        }).attr({ x: 0, y: 0 });
      }
    },
    // 渲染行号
    renderLineNumber(row, y) {
      const sentNumGroup = this.sentNumGroup;
      if (row.sentence) {
        const link = sentNumGroup.link('#/tutorials/bio/010-navigation?focus=sent~1');
        // debugger
        link.text('' + row.sentence).attr({
          x: OPTION.sentNumMargin - Configuration.visual.margin.x,
          y: y - OPTION.rowPadding, 'data-sent': row.sentence,
        });
      }
      sentNumGroup.line(OPTION.sentNumMargin, 0, OPTION.sentNumMargin, y).stroke({
        color: '#f06',
        width: 1,
        linecap: 'round',
      });
    },
    // 箭头
    renderArrow() {
      const marker = new Marker().attr({
        id: 'drag_arrow',
        refX: 5,
        refY: 2.5,
        markerWidth: 5,
        markerHeight: 5,
        orient: 'auto',
        markerUnits: 'strokeWidth', 'class': 'drag_fill',
      });
      marker.polyline([[0, 0], [5, 2.5], [0, 5], [0.2, 2.5]]);
      marker.addTo(this.defs);
    },
    // 调整画布尺寸
    resizeCanvas(maxTextWidth) {
      const width = maxTextWidth + OPTION.sentNumMargin + 2 * Configuration.visual.margin.x + 1;
      const canvasWidth = this.svgElement.width();
      this.canvasWidth = width > canvasWidth ? width : canvasWidth;
      this.svgElement.width(canvasWidth);
      this.svgElement.height(this.canvasHeight);
    },
    // 标注（背景高亮、大括号、文本等）
    renderFragment(chunk, sizes, y) {
      chunk.fragments.forEach(fragment => {
        const span = this.data.spans[fragment.spanId];
        // const span = fragment.span;
        const spanDesc = this.spanTypes[span.type];
        const bgColor = get(spanDesc, 'bgColor', get(this.spanTypes, 'SPAN_DEFAULT.bgColor', '#ffffff'));
        const fgColor = get(spanDesc, 'fgColor', get(this.spanTypes, 'SPAN_DEFAULT.fgColor', '#000000'));
        let borderColor = get(spanDesc, 'borderColor', get(this.spanTypes, 'SPAN_DEFAULT.borderColor', '#000000'));
        if (borderColor === 'darken') {
          borderColor = Util.adjustColorLightness(bgColor, -0.6);
        }
        fragment.group = chunk.group.group().addClass('span');
        if (!y) y = -sizes.texts.height;
        let x = (fragment.curly.from + fragment.curly.to) / 2;
        let yy = y + sizes.fragments.y;
        let hh = sizes.fragments.height;
        let ww = fragment.width;
        let xx = x - ww / 2;

        // 微调文本边距
        yy += OPTION.boxTextMargin.y;
        hh -= 2 * OPTION.boxTextMargin.y;
        xx += OPTION.boxTextMargin.x;
        ww -= 2 * OPTION.boxTextMargin.x;
        const rectClass = 'span_' + (span['cue'] || span.type) + ' span_default';

        let bx = xx - Configuration.visual.margin.x - OPTION.boxTextMargin.x;
        let by = yy - Configuration.visual.margin.y;
        let bw = ww + 2 * Configuration.visual.margin.x;
        let bh = hh + 2 * Configuration.visual.margin.y;

        if (OPTION.roundCoordinates) {
          x = (x | 0) + 0.5;
          bx = (bx | 0) + 0.5;
        }
        // 绘制标注背景
        fragment.rect = fragment.group.rect(bw, bh).attr({
          x: bx,
          y: by,
          class: rectClass,
          fill: bgColor,
          stroke: borderColor,
          rx: Configuration.visual.margin.x,
          ry: Configuration.visual.margin.y,
          'data-span-id': span.id,
          'data-fragment-id': fragment.id,
        });
        fragment.right = bx + bw;
        fragment.rectBox = { x: bx, y: by - span.floor, width: bw, height: bh };
        fragment.height = span.floor + hh + 3 * Configuration.visual.margin.y + Configuration.visual.curlyHeight + Configuration.visual.arcSpacing;

        fragment.rect.attr('y', yy - Configuration.visual.margin.y - span.floor);
        // 绘制标注文本
        fragment.group.text(this.data.spanAnnTexts[fragment.glyphedLabelText])
          .attr({
            x, y: y - span.floor, fill: fgColor,
          });
        // 绘制大括号
        if (fragment.drawCurly) {
          const curlyColor = chroma('grey').css();
          const bottom = yy + hh + Configuration.visual.margin.y - span.floor + 1;
          const path = this.draw.path()
            .M(fragment.curly.from, bottom + Configuration.visual.curlyHeight)
            .curveC(fragment.curly.from, bottom, x, bottom + Configuration.visual.curlyHeight, x, bottom)
            .curveC(x, bottom + Configuration.visual.curlyHeight, fragment.curly.to, bottom, fragment.curly.to, bottom + Configuration.visual.curlyHeight);
          fragment.group.path(path._path).attr({ 'stroke': curlyColor }).addClass('curly');
        }
      });
    },
    // 文本高亮
    renderArc(rows, sizes, fragmentHeights) {
      const arrows = {};
      this.data.arcs.forEach((arc) => {
        // separate out possible numeric suffix from type
        const originSpan = this.data.spans[arc.origin];
        const targetSpan = this.data.spans[arc.target];
        const { left, right, leftBox, rightBox } = this.getRowBBox(this.data, arc);
        const arcDesc = this.resolveArcDesc(arc, originSpan);
        const leftChunk = this.getChunkById(left.chunkId);
        const rightChunk = this.getChunkById(right.chunkId);
        const leftRow = leftChunk.row.index;
        const rightRow = rightChunk.row.index;
        this.generateArrows(arrows, arcDesc);
        // find the next height
        let height = this.findMaxFragmentHeight(fragmentHeights, left, right);
        const originChunk = this.getChunkById(originSpan.headFragment.chunkId);
        const targetChunk = this.getChunkById(targetSpan.headFragment.chunkId);
        const ufoCatcher = originChunk.index === targetChunk.index;
        const chunkReverse = ufoCatcher ? leftBox.x + leftBox.width / 2 < rightBox.x + rightBox.width / 2 : false;

        for (let rowIndex = leftRow; rowIndex <= rightRow; rowIndex++) {
          const row = rows[rowIndex];
          row.hasAnnotations = true;
          const arcGroup = row.arcs.group().attr({
            'data-from': arc.origin,
            'data-to': arc.target,
          });
          const from = rowIndex === leftRow ? leftBox.x + (chunkReverse ? 0 : leftBox.width) : OPTION.sentNumMargin;
          const to = rowIndex === rightRow ? rightBox.x + (chunkReverse ? rightBox.width : 0) : this.canvasWidth - 2 * Configuration.visual.margin.y;
          const originType = this.data.spans[arc.origin].type;
          const arcLabels = Util.getArcLabels(this.spanTypes, originType, arc.type, this.relationTypesHash);
          let labelText = Util.arcDisplayForm(this.spanTypes, originType, arc.type, this.relationTypesHash);
          if (Configuration.abbrevsOn && arcLabels) {
            let labelIdx = 1; // first abbreviation
            const maxLength = (to - from) - (OPTION.arcSlant);
            while (sizes.arcs.widths[labelText] > maxLength &&
            arcLabels[labelIdx]) {
              labelText = arcLabels[labelIdx];
              labelIdx++;
            }
          }
          const baseline_shift = sizes.arcs.height / 4;
          this.drawArcText(arcGroup, arc, arcDesc, from, to, labelText, height, baseline_shift);
          const width = sizes.arcs.widths[labelText];
          const textBox = {
            x: (from + to - width) / 2,
            width: width,
            y: -height - sizes.arcs.height / 2,
            height: sizes.arcs.height,
          };
          let textStart = textBox.x;
          let textEnd = textBox.x + textBox.width;
          textStart -= Configuration.visual.arcTextMargin;
          textEnd += Configuration.visual.arcTextMargin;
          if (from > to) {
            const tmp = textStart;
            textStart = textEnd;
            textEnd = tmp;
          }
          if (OPTION.roundCoordinates) {
            height = (height | 0) + 0.5;
          }
          // debugger
          if (height > row.maxArcHeight) row.maxArcHeight = height;
          this.drawLeftArc(arc, rows, rowIndex, arcGroup, height, arrows, textStart);
          this.drawRightArc(arc, arrows, rowIndex, arcGroup, height, textEnd);
        } // arc rows
      }); // arcs
    },
    renderChunkRect(sizes) {
      const lrChunkComp = function(chunk, a, b) {
        const ac = chunk.fragments[a];
        const bc = chunk.fragments[b];
        const startDiff = Util.cmp(ac.from, bc.from);
        return startDiff !== 0 ? startDiff : Util.cmp(bc.to - bc.from, ac.to - ac.from);
      };
      const rlChunkComp = function(chunk, a, b) {
        const ac = chunk.fragments[a];
        const bc = chunk.fragments[b];
        const endDiff = Util.cmp(bc.to, ac.to);
        return endDiff !== 0 ? endDiff : Util.cmp(bc.to - bc.from, ac.to - ac.from);
      };
      const highlightGroup = this.highlightGroup;
      this.data.chunks.forEach(chunk => {
        if (chunk.fragments.length) {
          const orderedIdx = [];
          for (let i = chunk.fragments.length - 1; i >= 0; i--) {
            orderedIdx.push(i);
          }

          orderedIdx.sort((a, b) => lrChunkComp(chunk, a, b));
          let openFragments = [];
          for (let i = 0; i < orderedIdx.length; i++) {
            const current = chunk.fragments[orderedIdx[i]];
            current.nestingHeightLR = 0;
            current.nestingDepthLR = 0;
            const stillOpen = [];
            for (let o = 0; o < openFragments.length; o++) {
              if (openFragments[o].to > current.from) {
                stillOpen.push(openFragments[o]);
                openFragments[o].nestingHeightLR++;
              }
            }
            openFragments = stillOpen;
            current.nestingDepthLR = openFragments.length;
            openFragments.push(current);
          }

          // re-sort for right-to-left traversal by end position
          orderedIdx.sort((a, b) => rlChunkComp(chunk, a, b));
          openFragments = [];
          for (let i = 0; i < orderedIdx.length; i++) {
            const current = chunk.fragments[orderedIdx[i]];
            current.nestingHeightRL = 0;
            current.nestingDepthRL = 0;
            const stillOpen = [];
            for (let o = 0; o < openFragments.length; o++) {
              if (openFragments[o].from < current.to) {
                stillOpen.push(openFragments[o]);
                openFragments[o].nestingHeightRL++;
              }
            }
            openFragments = stillOpen;
            current.nestingDepthRL = openFragments.length;
            openFragments.push(current);
          }

          for (let i = 0; i < orderedIdx.length; i++) {
            const c = chunk.fragments[orderedIdx[i]];
            c.nestingHeight = c.nestingHeightLR > c.nestingHeightRL ? c.nestingHeightLR : c.nestingHeightRL;
            c.nestingDepth = c.nestingDepthLR > c.nestingDepthRL ? c.nestingDepthLR : c.nestingDepthRL;
          }
          // Re-order by nesting height and draw in order
          orderedIdx.sort(function(a, b) {
            return Util.cmp(chunk.fragments[b].nestingHeight, chunk.fragments[a].nestingHeight);
          });

          for (let i = 0; i < chunk.fragments.length; i++) {
            const fragment = chunk.fragments[orderedIdx[i]];
            const span = this.data.spans[fragment.spanId];
            const spanDesc = this.spanTypes[span.type];
            const bgColor = get(spanDesc, 'bgColor', get(this.spanTypes, 'SPAN_DEFAULT.bgColor', '#ffffff'));
            let shrink = 0;
            if (fragment.nestingDepth > 1 && fragment.nestingHeight === 0) {
              shrink = 1;
            } else if (fragment.nestingDepth === 0 && fragment.nestingHeight > 0) {
              shrink = -1;
            }
            const yShrink = shrink * OPTION.nestingAdjustYStepSize;
            const xShrink = shrink * OPTION.nestingAdjustXStepSize;
            const yStartTweak = 1;
            fragment.highlightPos = {
              x: chunk.textX + fragment.curly.from + xShrink,
              y: chunk.row.textY + sizes.texts.y + yShrink + yStartTweak,
              w: fragment.curly.to - fragment.curly.from - 2 * xShrink,
              h: sizes.texts.height - 2 * yShrink - yStartTweak,
            };
            highlightGroup.rect(fragment.highlightPos.w, fragment.highlightPos.h)
              .attr({
                x: fragment.highlightPos.x, y: fragment.highlightPos.y, fill: chroma(bgColor).alpha(0.25).css(), //opacity:1,
                rx: OPTION.highlightRounding.x, ry: OPTION.highlightRounding.y,
              });
          }
        }
      });
    },
    drawLeftArc: function(arc, rows, index, arcGroup, height, arrows, textStart) {
      let path;
      const row = rows[index];
      const originSpan = this.data.spans[arc.origin];
      const targetSpan = this.data.spans[arc.target];
      const leftToRight = originSpan.headFragment.towerId < targetSpan.headFragment.towerId;
      const { leftBox, left, rightBox } = this.getRowBBox(this.data, arc);
      const arcDesc = this.resolveArcDesc(arc, originSpan);
      const chunk = this.getChunkById(left.chunkId);
      const originChunk = this.getChunkById(originSpan.headFragment.chunkId);
      const targetChunk = this.getChunkById(targetSpan.headFragment.chunkId);
      const leftRow = chunk.row.index;
      const ufoCatcher = originChunk.index === targetChunk.index;
      const chunkReverse = ufoCatcher ? leftBox.x + leftBox.width / 2 < rightBox.x + rightBox.width / 2 : void 0;
      const ufoCatcherMod = ufoCatcher ? chunkReverse ? -0.5 : 0.5 : 1;
      const from = index === leftRow ? leftBox.x + (chunkReverse ? 0 : leftBox.width) : OPTION.sentNumMargin;


      if (OPTION.roundCoordinates) height = (height | 0) + 0.5;
      if (height > row.maxArcHeight) row.maxArcHeight = height;
      const symmetric = get(arcDesc, 'properties.symmetric');
      const dashArray = get(arcDesc, 'dashArray');
      const color = defaultTo(get(arcDesc, 'color'), defaultTo(get(this.spanTypes, 'ARC_DEFAULT.color'), '#000000'));
      const myArrowHead = defaultTo(get(arcDesc, 'arrowHead'), get(this.spanTypes, 'ARC_DEFAULT.arrowHead'));
      const arrowName = (leftToRight ? symmetric && myArrowHead || 'none' : myArrowHead || 'triangle,5') + ',' + color;
      const arrowType = arrows[arrowName];
      const arrowDecl = arrowType && ('url(#' + arrowType + ')');


      let arrowAtLabelAdjust = 0;
      let labelArrowDecl = null;
      const myLabelArrowHead = get(arcDesc, 'labelArrow', get(this.spanTypes, 'ARC_DEFAULT.labelArrow'));

      if (myLabelArrowHead) {
        const labelArrowName = defaultTo(leftToRight ? (symmetric ? myLabelArrowHead : 'none') : myLabelArrowHead, 'triangle,5') + ',' + color;
        const labelArrow = labelArrowName.split(',');
        arrowAtLabelAdjust = labelArrow[0] !== 'none' && parseInt(labelArrow[1], 10) || 0;
        const labelArrowType = arrows[labelArrowName];
        labelArrowDecl = labelArrowType && ('url(#' + labelArrowType + ')');
        if (ufoCatcher) arrowAtLabelAdjust = -arrowAtLabelAdjust;
      }
      const arrowStart = textStart - arrowAtLabelAdjust;
      path = this.draw.path().M(arrowStart, -height);
      if (index === leftRow) {
        let cornerX = from + ufoCatcherMod * OPTION.arcSlant;
        if (!ufoCatcher && cornerX > arrowStart - 1) {
          cornerX = arrowStart - 1;
        }
        if (OPTION.smoothArcCurves) {
          const controlX = ufoCatcher ? cornerX + 2 * ufoCatcherMod * OPTION.reverseArcControlX : OPTION.smoothArcSteepness * from + (1 - OPTION.smoothArcSteepness) * cornerX;
          let endY = leftBox.y + (leftToRight || arc.equiv ? leftBox.height / 2 : Configuration.visual.margin.y);
          if (Math.abs(-height - endY) < 2 && Math.abs(cornerX - from) < 5) {
            endY = -height;
          }
          path.line(cornerX, -height).curveQ(controlX, -height, from, endY);
        } else {
          path.line(cornerX, -height).line(from, leftBox.y + (leftToRight || arc.equiv ? leftBox.height / 2 : Configuration.visual.margin.y));
        }
      } else {
        path.line(from, -height);
      }
      arcGroup.path(path._path).attr({
        'marker-end': arrowDecl,
        'marker-start': labelArrowDecl,
        style: 'stroke: ' + color,
        'stroke-dasharray': dashArray,
      });
    },
    drawRightArc: function(arc, arrows, index, arcGroup, height, textEnd) {
      let path;
      const originSpan = this.data.spans[arc.origin];
      const targetSpan = this.data.spans[arc.target];
      const arcDesc = this.resolveArcDesc(arc, originSpan);
      const { right, leftBox, rightBox } = this.getRowBBox(this.data, arc);


      const chunk = this.getChunkById(right.chunkId);
      const originChunk = this.getChunkById(originSpan.headFragment.chunkId);
      const targetChunk = this.getChunkById(targetSpan.headFragment.chunkId);
      const rightRow = chunk.row.index;
      const ufoCatcher = originChunk.index === targetChunk.index;
      const chunkReverse = ufoCatcher ? leftBox.x + leftBox.width / 2 < rightBox.x + rightBox.width / 2 : void 0;
      const ufoCatcherMod = ufoCatcher ? chunkReverse ? -0.5 : 0.5 : 1;
      const leftToRight = originSpan.headFragment.towerId < targetSpan.headFragment.towerId;
      const myArrowHead = get(arcDesc, 'arrowHead', get(this.spanTypes, 'ARC_DEFAULT.arrowHead'));
      const symmetric = get(arcDesc, 'properties.symmetric');
      const dashArray = get(arcDesc, 'dashArray');
      const color = defaultTo(get(arcDesc, 'color'), defaultTo(get(this.spanTypes, 'ARC_DEFAULT.color'), '#000000'));
      const arrowName = defaultTo(leftToRight ? myArrowHead : symmetric && myArrowHead, leftToRight ? 'triangle,5' : 'none') + ',' + color;
      const arrowType = arrows[arrowName];
      const arrowDecl = arrowType && ('url(#' + arrowType + ')');
      const to = index === rightRow ? rightBox.x + (chunkReverse ? rightBox.width : 0) : this.svgElement.width() - 2 * Configuration.visual.margin.y;

      let arrowAtLabelAdjust = 0;
      let labelArrowDecl = null;
      const myLabelArrowHead = get(arcDesc, 'labelArrow', get(this.spanTypes, 'ARC_DEFAULT.labelArrow'));

      if (myLabelArrowHead) {
        const labelArrowName = (leftToRight ? myLabelArrowHead || 'triangle,5' : symmetric && myLabelArrowHead || 'none') + ',' + color;
        const labelArrowSplit = labelArrowName.split(',');
        arrowAtLabelAdjust = labelArrowSplit[0] !== 'none' && parseInt(labelArrowSplit[1], 10) || 0;
        const labelArrowType = arrows[labelArrowName];
        labelArrowDecl = labelArrowType && ('url(#' + labelArrowType + ')');
        if (ufoCatcher) arrowAtLabelAdjust = -arrowAtLabelAdjust;
      }
      const arrowEnd = textEnd + arrowAtLabelAdjust;
      path = this.draw.path().M(arrowEnd, -height);

      if (index === rightRow) {
        let cornerX = to - ufoCatcherMod * OPTION.arcSlant;
        if (!ufoCatcher && cornerX < arrowEnd + 1) {
          cornerX = arrowEnd + 1;
        }
        if (OPTION.smoothArcCurves) {
          const controlX = ufoCatcher ? cornerX - 2 * ufoCatcherMod * OPTION.reverseArcControlX : OPTION.smoothArcSteepness * to + (1 - OPTION.smoothArcSteepness) * cornerX;
          let endY = rightBox.y + (leftToRight && !arc.equiv ? Configuration.visual.margin.y : rightBox.height / 2);
          if (Math.abs(-height - endY) < 2 &&
            Math.abs(cornerX - to) < 5) {
            endY = -height;
          }
          path.line(cornerX, -height).curveQ(controlX, -height, to, endY);
        } else {
          path.line(cornerX, -height).line(to, rightBox.y + (leftToRight && !arc.equiv ? Configuration.visual.margin.y : rightBox.height / 2));
        }
      } else {
        path.line(to, -height);
      }
      arcGroup.path(path._path).attr({
        'marker-end': arrowDecl,
        'marker-start': labelArrowDecl,
        style: 'stroke: ' + color,
        'stroke-dasharray': dashArray,
      });
    },
    adjustFragmentSizes: function(data) {
      const towers = data.towers;
      for (let k in towers) {
        const maxWidth = Math.max(...towers[k].map((fragment) => {
          const width = data.sizes.fragments.widths[fragment.glyphedLabelText];
          return width || 0;
        }));
        towers[k].forEach((fragment) => {
          fragment.width = maxWidth;
        });
      }
      return towers;
    },
    translate: function(element, x, y) {
      $(element.group.node).attr('transform', `translate(${x}, ${y})`);
      element.translation = { x: x, y: y };
    },
    createDefs: function() {
      const commentName = 'commentName';
      this.svgElement.append('<!-- document: ' + commentName + ' -->');
      this.defs = this.draw.defs();
      this.defs.element('filter', { id: 'Gaussian_Blur' }).element('feGaussianBlur', {
        in: 'SourceGraphic',
        stdDeviation: '2',
      });
    },
    sortArcs: function(data, fragmentHeights) {
      // 预计算每个arc的 jumpHeight 和 heightSum
      const arcHeightSums = {};
      data.arcs.forEach(arc => {
        arc.jumpHeight = this.calcJumpHeight(arc, data, fragmentHeights);
        arcHeightSums[arc.id] = data.spans[arc.origin].headFragment.height + data.spans[arc.target].headFragment.height;
      });
      // 排序函数
      data.arcs.sort((a, b) => {
        if (a.jumpHeight !== b.jumpHeight) return a.jumpHeight - b.jumpHeight;
        if (a.dist !== b.dist) return a.dist - b.dist;
        const aHeightSum = arcHeightSums[a.id];
        const bHeightSum = arcHeightSums[b.id];
        if (aHeightSum !== bHeightSum) return aHeightSum - bHeightSum;
        return data.spans[a.origin].headFragment.height - data.spans[b.origin].headFragment.height;
      });
    },
    calcJumpHeight: function(arc, data, fragmentHeights) {
      const fromFragment = data.spans[arc.origin].headFragment;
      const toFragment = data.spans[arc.target].headFragment;
      const fromChunk = this.getChunkById(fromFragment.chunkId);
      const toChunk = this.getChunkById(toFragment.chunkId);
      // 确定 from 和 to
      const [minTowerId, maxTowerId] = fromFragment.towerId <= toFragment.towerId ? [fromFragment.towerId, toFragment.towerId] : [toFragment.towerId, fromFragment.towerId];
      let from, to;
      if (fromChunk.index === toChunk.index) {
        from = minTowerId;
        to = maxTowerId;
      } else {
        from = minTowerId + 1;
        to = maxTowerId - 1;
      }
      let jumpHeight = 0;
      for (let i = from; i <= to; i++) {
        jumpHeight = Math.max(jumpHeight, fragmentHeights[i * 2]);
      }
      return jumpHeight;
    },
    calcFloorAndReservations: function(span, floors, reservations, sizes) {
      const f1 = span.fragments[0];
      const f2 = span.fragments[span.fragments.length - 1];
      const x1 = (f1.curly.from + f1.curly.to - f1.width) / 2 - Configuration.visual.margin.x;
      const x2 = (f2.curly.from + f2.curly.to + f2.width) / 2 + Configuration.visual.margin.x;
      const curlyHeight = span.drawCurly ? Configuration.visual.curlyHeight : 0;
      const h = sizes.fragments.height + curlyHeight + Configuration.visual.boxSpacing + 2 * Configuration.visual.margin.y - 3;
      let carpet = 0;
      let outside = true;
      const chunk1 = this.getChunkById(f1.chunkId);
      const chunk2 = this.getChunkById(f2.chunkId);


      floors.forEach((floor) => {
        let a = true;
        for (let i = chunk1.index; i <= chunk2.index; i++) {
          if (!reservations[i]?.[floor]) continue;
          const from = i === chunk1.index ? x1 : -Infinity;
          const to = i === chunk2.index ? x2 : Infinity;
          for (const [resFrom, resTo] of reservations[i][floor]) {
            if (resFrom < to && from < resTo) {
              a = false;
              break;
            }
          }
        }
        if (a) {
          if (carpet === null) {
            carpet = floor;
          } else if (h + carpet <= floor) {
            outside = false;
          }
        } else {
          carpet = null;
        }
      });

      if (outside) {
        const ceiling = carpet + h;
        const carpetNo = this.makeNewFloorIfNeeded(reservations, floors, carpet);
        for (let floorNo = carpetNo; floors[floorNo] < ceiling; floorNo++) {
          const floor = floors[floorNo];
          const headroom = ceiling - floor;

          // for (let i = f1.chunk.index; i <= f2.chunk.index; i++) {
          for (let i = chunk1.index; i <= chunk2.index; i++) {
            const from = i === chunk1.index ? x1 : 0;
            const to = i === chunk2.index ? x2 : Infinity;
            if (!reservations[i]) reservations[i] = {};
            if (!reservations[i][floor]) reservations[i][floor] = [];
            reservations[i][floor].push([from, to, headroom]);
          }
        }
      }
      span.floor = carpet + curlyHeight;
    },
    makeNewFloorIfNeeded: function(reservations, floors, floor) {
      let floorNo = floors.findIndex(flr => flr === floor);
      if (floorNo === -1) {
        floors.push(floor);
        floors.sort(Util.cmp);
        floorNo = floors.findIndex(flr => flr === floor);

        if (floorNo !== 0) {
          const parquet = floors[floorNo - 1];
          reservations.forEach(function(reservationsForDay) {
            if (reservationsForDay && reservationsForDay[parquet]) {
              const footRoom = floor - parquet;

              reservationsForDay[parquet].forEach(function([res0, res1, res2]) {
                if (res2 > footRoom) {
                  if (!reservationsForDay[floor]) {
                    reservationsForDay[floor] = [];
                  }
                  reservationsForDay[floor].push([res0, res1, res2 - footRoom]);
                }
              });
            }
          });
        }
      }
      return floorNo;
    },
    findMaxFragmentHeight: function(fragmentHeights, left, right) {
      let height = 0;
      let fromIndex2, toIndex2;
      const leftChunk = this.getChunkById(left.chunkId);
      const rightChunk = this.getChunkById(right.chunkId);
      if (leftChunk.index === rightChunk.index) {
        fromIndex2 = left.towerId * 2;
        toIndex2 = right.towerId * 2;
      } else {
        fromIndex2 = left.towerId * 2 + 1;
        toIndex2 = right.towerId * 2 - 1;
      }
      for (let i = fromIndex2; i <= toIndex2; i++) {
        if (fragmentHeights[i] > height) height = fragmentHeights[i];
      }
      height += Configuration.visual.arcSpacing;
      for (let i = fromIndex2; i <= toIndex2; i++) {
        if (fragmentHeights[i] < height) fragmentHeights[i] = height;
      }
      height += 0.5;
      return height;
    },
    resolveArcDesc: function(arc, originSpan) {
      let noNumArcType;
      let splitArcType;
      if (arc.type) {
        splitArcType = arc.type.match(/^(.*?)(\d*)$/);
        noNumArcType = splitArcType[1];
      }
      let arcDesc;
      const spanDesc = this.spanTypes[originSpan.type];
      get(spanDesc, 'arcs', []).forEach(item => {
        if (item.type === arc.type) {
          arcDesc = item;
        }
      });
      if (!arcDesc && noNumArcType && noNumArcType !== arc.type) {
        get(spanDesc, 'arcs', []).forEach(item => {
          if (item.type === noNumArcType) {
            arcDesc = item;
          }
        });
      }
      if (!arcDesc) {
        arcDesc = $.extend({}, this.relationTypesHash[arc.type] || this.relationTypesHash[noNumArcType]);
      }
      return arcDesc;
    },
    drawArcText: function(arcGroup, arc, arcDesc, from, to, labelText, height, baseline_shift) {
      const color = defaultTo(get(arcDesc, 'color'), defaultTo(get(this.spanTypes, 'ARC_DEFAULT.color'), '#000000'));
      let splitArcType;
      if (arc.type) splitArcType = arc.type.match(/^(.*?)(\d*)$/);
      const options = {
        'fill': color,
        'data-arc-role': arc.type,
        'data-arc-origin': arc.origin,
        'data-arc-target': arc.target,
        'data-arc-id': arc.id,
        'data-arc-ed': arc.eventDescId,
      };
      let svgText;
      if (!splitArcType[2]) {
        svgText = labelText;
      } else {
        const splitLabelText = labelText.match(/^(.*?)(\d*)$/);
        const noNumLabelText = splitLabelText[1];
        svgText = this.draw.text(null).tspan(noNumLabelText).attr(options);
        const subscriptSettings = { 'dy': '0.3em', 'font-size': '80%' };
        $.extend(subscriptSettings, options);
        svgText.tspan(splitArcType[2], subscriptSettings);
      }
      // const baseline_shift = sizes.arcs.height / 4;
      return arcGroup.text(svgText).attr({
        x: (from + to) / 2,
        y: -height + baseline_shift,
        ...options,
      });
    },
    getRowBBox: function(data, arc) {
      const originSpan = data.spans[arc.origin];
      const targetSpan = data.spans[arc.target];
      const leftToRight = originSpan.headFragment.towerId < targetSpan.headFragment.towerId;
      let left, right;
      if (leftToRight) {
        left = originSpan.headFragment;
        right = targetSpan.headFragment;
      } else {
        left = targetSpan.headFragment;
        right = originSpan.headFragment;
      }
      return { left, right, leftBox: this.rowBBox(left), rightBox: this.rowBBox(right) };
    },
    rowBBox: function(span) {
      const box = $.extend({}, span.rectBox); // clone
      const chunk = this.getChunkById(span.chunkId);
      const translation = chunk.translation;
      box.x += translation.x;
      box.y += translation.y;
      return box;
    },
    getSizes: function() {
      const chunkTexts = {}; // set of span texts
      this.data.chunks.forEach(chunk => {
        chunk.row = undefined; // reset
        if (!(chunk.text in chunkTexts)) chunkTexts[chunk.text] = [];
        const text = chunkTexts[chunk.text];
        text.push.apply(text, chunk.fragments);
      });
      const textSizes = this.measureText(chunkTexts, undefined, (fragment, text) => {
        const include = ['id', 'spanId', 'from', 'to'].every(key => fragment[key] !== undefined);
        if (include) {
          // let firstChar = fragment.from - fragment.chunk?.from || 0;
          let firstChar = fragment.from - fragment.from || 0;
          if (firstChar < 0) {
            firstChar = 0;
            console.info('WARNING');
          }
          const startPos = text.getStartPositionOfChar(firstChar).x;
          const lastChar = fragment.to - fragment.from - 1;
          const endPos = (lastChar < 0) ? startPos : text.getEndPositionOfChar(lastChar).x;
          fragment.curly = {
            from: startPos, to: endPos,
          };
        } else { // it's markedText [id, start?, char#, offset]
          if (fragment[2] < 0) fragment[2] = 0;
          if (!fragment[2]) { // start
            fragment[3] = text.getStartPositionOfChar(fragment[2]).x;
          } else {
            fragment[3] = text.getEndPositionOfChar(fragment[2] - 1).x + 1;
          }
        }
      });
      // get the fragment annotation text sizes
      const fragmentTexts = {};
      let noSpans = true;
      Object.values(this.data.spans).forEach(span => {
        span.fragments.forEach(fragment => {
          fragmentTexts[fragment.glyphedLabelText] = true;
          noSpans = false;
        });
      });
      if (noSpans) fragmentTexts.$ = true; // dummy so we can at least get the height
      const fragmentSizes = this.measureText(fragmentTexts, { 'class': 'span' });
      //
      const arcTexts = {};
      this.data.arcs.forEach((arc) => {
        const labels = Util.getArcLabels(this.spanTypes, this.data.spans[arc.origin].type, arc.type, this.relationTypesHash) || [arc.type];
        labels.forEach((label) => {
          arcTexts[label] = true;
        });
      });
      const arcs = this.measureText(arcTexts, { class: 'arcs' });
      return {
        texts: textSizes, fragments: fragmentSizes, arcs,
      };
    },
    measureText(textsHash, options, callback) {
      options = options === undefined ? {} : options;
      const textMeasureGroup = this.draw.group().attr(options);
      for (const text in textsHash) {
        textMeasureGroup.text(text).attr({ x: 0, y: 0 });
      }
      // measuring goes on here
      const widths = {};
      textMeasureGroup.find('text').forEach((svgText) => {
        const text = svgText.text();
        widths[text] = svgText.node.getComputedTextLength();
        if (callback) {
          textsHash[text].forEach(object => {
            callback(object, svgText.node);
          });
        }
      });
      const bbox = textMeasureGroup.bbox();
      textMeasureGroup.remove();
      return { widths, height: bbox.height, y: bbox.y };
    },
    generateArrows: function(arrows, arcDesc) {
      const color = defaultTo(get(arcDesc, 'color'), defaultTo(get(this.spanTypes, 'ARC_DEFAULT.color'), '#000000'));
      const arrowHead = defaultTo(get(arcDesc, 'arrowHead'), defaultTo(get(this.spanTypes, 'ARC_DEFAULT.arrowHead'), 'triangle,5')) + ',' + color;
      const labelArrowHead = defaultTo(get(arcDesc, 'labelArrow'), defaultTo(get(this.spanTypes, 'ARC_DEFAULT.labelArrow'), 'triangle,5')) + ',' + color;
      if (!arrows[arrowHead]) {
        const arrow = this._makeArrow(arrowHead);
        if (arrow) arrows[arrowHead] = arrow;
      }
      if (!arrows[labelArrowHead]) {
        const arrow = this._makeArrow(labelArrowHead);
        if (arrow) arrows[labelArrowHead] = arrow;
      }
    },
    _makeArrow: function(spec) {
      const parsedSpec = spec.split(',');
      const type = parsedSpec[0];
      if (type === 'none') return;
      let width;
      let height;
      let color;
      if ($.isNumeric(parsedSpec[1]) && parsedSpec[2]) {
        if ($.isNumeric(parsedSpec[2]) && parsedSpec[3]) {
          width = parsedSpec[1];
          height = parsedSpec[2];
          color = parsedSpec[3] || 'black';
        } else {
          width = height = parsedSpec[1];
          color = parsedSpec[2] || 'black';
        }
      } else {
        width = height = 5;
        color = parsedSpec[1] || 'black';
      }
      const arrowId = 'arrow_' + spec.replace(/#/g, '').replace(/,/g, '_');

      let arrow;
      if (type === 'triangle') {
        // parent id, refX, refY, mWidth, mHeight, orient, settings

        arrow = new Marker({
          id: arrowId,
          refX: width,
          refY: height / 2,
          markerWidth: width,
          markerHeight: height,
          orient: 'auto',
          markerUnits: 'strokeWidth', 'fill': color,
        });
        arrow.polyline([[0, 0], [width, height / 2], [0, height], [width / 12, height / 2]]);
        arrow.addTo(this.defs);
      }
      return arrowId;
    },
  });
}

export default render;