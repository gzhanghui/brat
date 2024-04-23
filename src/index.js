import { warn } from './util/debug';
import $ from 'jquery';
import { SVG } from '@svgdotjs/svg.js';
import './util/svg.path';
import { cloneDeep, get, orderBy } from 'lodash';
import { Arc, Chunk, DocumentData, EventDesc, Span } from './class';
import Util from './util';
import render from './render';
import behaviors from './event';
import './index.scss';

function Brat() {
  this._init();
}

render(Brat);
behaviors(Brat);

$.extend(Brat.prototype, {
  _init: function() {
    this.draw = SVG().addTo('#svg');
    this.svgElement = $('#svg svg');
    this.ajax(this.setData.bind(this));
    this.draw.on('click',(e)=>{
      console.log(e);
    })
    this.createAlert()
    this.bindEvent()
  },
  ajax: function(callback) {
    $.get('./getCollectionInformation.json').then(res => {
      this.information = res;
      $.get('./data.json').then(data => {
        this.sourceData = data;
        callback && callback();
      });
    });
  },
  // 初始缺省参数
  _setSourceDataDefaults: function() {
    const list = ['attributes', 'comments', 'entities', 'equivs', 'events', 'modifications', 'normalizations', 'relations', 'triggers'];
    list.forEach(item => {
      if (this.sourceData[item] == null) {
        this.sourceData[item] = [];
      }
    });
  },
  // 处理 data
  setData: function() {
    this._setSourceDataDefaults();
    // 初始化 DocumentData
    this.data = new DocumentData(this.sourceData.text);
    // ID TYPE OFFSETS
    this.sourceData.entities.forEach(item => {
      this.data.spans[item[0]] = new Span(item[0], item[1], item[2]);
    });
    get(this.sourceData, 'events', []).forEach(item => {
      const eventDesc = new EventDesc(item[0], item[1], item[2]);
      const trigger = get(this.sourceData, 'triggers', []).find(t => eventDesc.triggerId === t[0]);
      this.data.spans[eventDesc.id] = new Span(eventDesc.id, trigger[1], trigger[2]);
      this.data.eventDescs[item[0]] = eventDesc;
    });
    Object.values(this.data.spans).forEach(span => {
      span.offsets.forEach(([from, to], index) => {
        span.fragments.push({ id: index, spanId: span.id, from: parseInt(from, 10), to: parseInt(to, 10) });
      });
      span.fragments = orderBy(span.fragments, value => value.form - value.to, 'desc');
      span.headFragment = span.fragments[span.fragments.length - 1];
    });
    const relationTypesHash = this.analysisRelation(this.sourceData);
    get(this.sourceData, 'equivs', []).forEach((item, index) => {
      item[0] = '*' + index;
      const equivSpans = item.slice(2);
      const okEquivSpans = [];
      equivSpans.forEach(m => {
        if (this.data.spans[m]) okEquivSpans.push(m);
      });
      okEquivSpans.sort((a, b) => {
        const aSpan = this.data.spans[a];
        const bSpan = this.data.spans[b];
        const tmp = aSpan.headFragment.from + aSpan.headFragment.to - bSpan.headFragment.from - bSpan.headFragment.to;
        if (tmp) {
          return tmp < 0 ? -1 : 1;
        }
        return 0;
      });
      for (let i = 1; i < okEquivSpans.length; i++) {
        const eventDesc = (this.data.eventDescs[item[0] + '*' + i] = new EventDesc(okEquivSpans[i - 1], okEquivSpans[i - 1], [[item[1], okEquivSpans[i]]], 'equiv'));
        eventDesc.leftSpans = okEquivSpans.slice(0, i);
        eventDesc.rightSpans = okEquivSpans.slice(i);
      }
    });
    get(this.sourceData, 'relations', []).forEach(item => {
      let argsDesc = relationTypesHash[item[1]];
      argsDesc = argsDesc && argsDesc.args;
      let t1, t2;
      if (argsDesc) {
        const args = {};
        args[item[2][0][0]] = item[2][0][1];
        args[item[2][1][0]] = item[2][1][1];
        t1 = args[argsDesc[0].role];
        t2 = args[argsDesc[1].role];
      } else {
        t1 = item[2][0][1];
        t2 = item[2][1][1];
      }
      //  (id, triggerId, roles,  klass)
      this.data.eventDescs[item[0]] = new EventDesc(t1, t1, [[item[1], t2]], 'relation');
    });

    const fragments = this.getFragments();
    this.processFragmentChunks(fragments);
    this.processArcAndSpan();
    this.assignTowerIds(fragments);
    this.addTowers();
    this.generateChunkTexts();
    this.data = cloneDeep(this.data);
    console.info('dataReady', this.data);
    this.renderDataReal();
  },
  processFragmentChunks(fragments) {
    let fragmentList = fragments;
    let chunkNo = 0;
    this.data.chunks = this.chunkByTokenOffset();
    let numChunks = this.data.chunks.length;
    // 查找句子边界
    let sentenceNo = 0;
    let pastFirst = false;
    get(this.sourceData, 'sentence_offsets', []).forEach((item) => {
      const from = item[0];
      if (chunkNo >= numChunks) return false;
      if (this.data.chunks[chunkNo].from > from) return;
      let chunk;
      while (chunkNo < numChunks && (chunk = this.data.chunks[chunkNo]).from < from) {
        chunkNo++;
      }
      chunkNo++;
      if (pastFirst && from <= chunk.from) {
        let num = chunk.space.split('\n').length - 1;
        if (!num) num = 1;
        sentenceNo += num;
        chunk.sentence = sentenceNo;
      } else {
        pastFirst = true;
      }
    });
    // 将 fragments 分配给适当的 chunk
    let chunkId = 0;
    fragmentList.forEach((fragment) => {
      let chunk = this.data.chunks[chunkId];
      while (fragment.to > chunk.to) {
        chunkId++;
        chunk = this.data.chunks[chunkId];
      }
      // 找到 fragment 对应的 chunk
      fragment.text = chunk.text.substring(fragment.from - chunk.from, fragment.to - chunk.from);
      fragment.chunkId = chunkId;
      // fragment.chunk =chunk
      chunk.fragments.push(fragment);
    });
    this.data.chunks.forEach(chunk => {
      chunk.fragments.sort(this.fragmentComparator);
      chunk.fragments.forEach((fragment, index) => {
        fragment.indexNumber = index;
        fragment.drawOrder = index;
      });
    });
    return fragmentList;
  },
  processArcAndSpan() {
    Object.values(this.data.spans).forEach(span => {
      span.avgDist = span.numArcs ? span.totalDist / span.numArcs : 0;
      const fragmentTexts = [];
      span.fragments.forEach(fragment => {
        fragmentTexts.push(fragment.text);
      });
      span.text = fragmentTexts.join('');
    });
    for (let i = 0; i < 2; i++) {
      Object.values(this.data.spans).forEach(span => {
        span.refedIndexSum = 0;
      });
      this.data.arcs.forEach(arc => {
        this.data.spans[arc.origin].refedIndexSum += this.data.spans[arc.target].headFragment.indexNumber;
      });
    }
    const { arcs, arcById } = this.generateArcs();
    this.data.arcs = arcs;
    this.data.arcById = arcById;
  },
  assignTowerIds: function(fragments) {
    let lastFragment = null;
    let towerId = -1;
    fragments.forEach((fragment) => {
      if (!lastFragment || lastFragment.from !== fragment.from || lastFragment.to !== fragment.to) {
        towerId++;
      }
      fragment.towerId = towerId;
      lastFragment = fragment;
    });
    return fragments;
  },
  addTowers: function() {
    const data = this.data;
    data.order = Object.keys(this.data.spans).sort((a, b) => {
      const spanA = this.data.spans[a];
      const spanB = this.data.spans[b];
      const diff = spanA.headFragment.drawOrder - spanB.headFragment.drawOrder;
      return diff < 0 ? -1 : diff > 0 ? 1 : 0;
    });

    data.order.forEach(spanId => {
      const span = data.spans[spanId];
      span.fragments.forEach(fragment => {
        if (!data.towers[fragment.towerId]) {
          data.towers[fragment.towerId] = [];
          fragment.drawCurly = true;
          data.spans[fragment.spanId].drawCurly = true;
          // fragment.span.drawCurly = true;
        }
        data.towers[fragment.towerId].push(fragment);
      });
    });
  },
  chunkByTokenOffset: function() {
    const fragments = this.getFragments();
    const chunks = [];
    let firstFrom = null;
    let space = null;
    let chunk = null;
    let lastTo = 0;
    let index = 0;
    let currentId = 0;
    let length = fragments.length;
    get(this.sourceData, 'token_offsets', []).forEach(([from, to]) => {
      if (firstFrom === null) firstFrom = from;
      while (currentId < length && to >= fragments[currentId].to) {
        currentId++;
      }
      if (currentId < length && to > fragments[currentId].from) {
        return;
      }
      space = this.data.text.substring(lastTo, firstFrom);
      const text = this.data.text.substring(firstFrom, to);
      if (chunk) chunk.nextSpace = space;
      chunk = new Chunk(index++, text, firstFrom, to, space);
      chunks.push(chunk);
      lastTo = to;
      firstFrom = null;
    });
    return chunks;
  },
  generateChunkTexts: function() {
    const spanTypes = this.analysisTypes(this.information);
    const spanAnnTexts = {};
    this.data.chunks.forEach((chunk) => {
      chunk.fragments.forEach((fragment) => {
        if (chunk.firstFragmentIndex === undefined) {
          chunk.firstFragmentIndex = fragment.towerId;
        }
        chunk.lastFragmentIndex = fragment.towerId;
        const spanLabels = Util.getSpanLabels(spanTypes, this.data.spans[fragment.spanId].type);
        fragment.labelText = spanLabels[0] || this.data.spans[fragment.spanId].type;
        // Find the most appropriate label according to text width
        if (window.Configuration.abbrevsOn && spanLabels) {
          let labelIdx = 1; // first abbrev
          const maxLength = (fragment.to - fragment.from) / 0.8;
          while (fragment.labelText.length > maxLength && spanLabels[labelIdx]) {
            fragment.labelText = spanLabels[labelIdx];
            labelIdx++;
          }
        }

        let text = fragment.labelText;
        fragment.glyphedLabelText = text;
        if (!spanAnnTexts[text]) {
          spanAnnTexts[text] = true;
          this.data.spanAnnTexts[text] = fragment.labelText;
        }
      });
    });
  },
  generateArcs: function() {
    const arcs = [];
    const arcById = {};
    Object.values(this.data.eventDescs).forEach(item => {
      const origin = this.data.spans[item.id];
      if (!origin) {
        warn('eventDesc');
        return;
      }
      const here = origin.headFragment.from + origin.headFragment.to;
      item.roles.forEach((role, index) => {
        const target = this.data.spans[role.targetId];
        if (!target) {
          warn('eventDesc.roles');
          return;
        }
        const there = target.headFragment.from + target.headFragment.to;
        const dist = Math.abs(here - there);
        const arc = new Arc(item, role, dist, index);
        origin.totalDist += dist;
        origin.numArcs++;
        target.totalDist += dist;
        target.numArcs++;
        target.incoming.push(arc);
        origin.outgoing.push(arc);
        arcs.push(arc);
        const arcId = origin.id + '--' + role.type + '--' + target.id;
        arcById[arcId] = arc;
      });
    });
    return { arcById, arcs };
  },
  getFragments: function() {
    const fragments = [];
    const spans = Object.values(this.data.spans);
    spans.forEach(span => {
      span.fragments.forEach(f => {
        fragments.push((f));
      });
    });
    fragments.sort((a, b) => {
      let x = a.from;
      let y = b.from;
      if (x === y) {
        x = a.to;
        y = b.to;
      }
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return fragments;
  },
  getChunkById(chunkId) {
    return this.data.chunks.find(c => c.index === chunkId);
  },
  fragmentComparator: function(a, b) {
    const aSpan = a.span;
    const bSpan = b.span;
    // 判断fragments长度
    let result = aSpan.fragments.length - bSpan.fragments.length;
    if (result !== 0) {
      return result < 0 ? 1 : -1;
    }
    // 判断avgDist
    result = aSpan.avgDist - bSpan.avgDist;
    if (result !== 0) {
      return result < 0 ? -1 : 1;
    }
    // 判断numArcs
    result = aSpan.numArcs - bSpan.numArcs;
    if (result !== 0) {
      return result < 0 ? -1 : 1;
    }
    // 判断跨度大小并考虑特殊情况
    const ad = a.to - a.from;
    const bd = b.to - b.from;
    result = (aSpan.numArcs === 0 && bSpan.numArcs === 0) ? -ad + bd : ad - bd;
    if (result !== 0) {
      return result < 0 ? 1 : -1;
    }
    result = aSpan.refedIndexSum - bSpan.refedIndexSum;
    if (result !== 0) {
      return result < 0 ? -1 : 1;
    }
    return aSpan.type < bSpan.type ? -1 : aSpan.type > bSpan.type ? 1 : 0;
  },
  analysisRelation: function(data) {
    const result = {};
    get(data, 'relation_types', []).forEach(item => {
      result[item.type] = item;
    });
    return result;
  },
  analysisTypes: function(data) {
    const spanTypes = {};
    const loadSpanTypes = (types = []) => {
      types.forEach(item => {
        if (item) {
          spanTypes[item.type] = item;
          const children = item.children;
          if (children && children.length) {
            loadSpanTypes(children);
          }
        }
      });
    };
    loadSpanTypes(get(data, 'entity_types'));
    loadSpanTypes(get(data, 'event_types'));
    loadSpanTypes(get(data, 'unconfigured_types'));
    return spanTypes;
  },
});
export default Brat;
new Brat();



