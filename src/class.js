
class DocumentData {
  constructor(text) {
    this.text = text;
    this.chunks = [];
    this.spans = {};
    this.arcs = [];
    this.arcById = {};
    this.spanAnnTexts = {};
    this.eventDescs = {};
    this.towers = {};
    this.order = [];
  }

}


class Span {
  constructor(id, type, offsets) {
    this.id = id;
    this.type = type;
    this.offsets = offsets;
    this.totalDist = 0;
    this.numArcs = 0;
    this.headFragment = null;
    this.incoming = [];
    this.outgoing = [];
    this.fragments = [];
  }
  findSpanById(id){

  }
}

class EventDesc {
  constructor(id, triggerId, roles, klass) {
    this.id = id;
    this.triggerId = triggerId;
    this.roles = roles.map(role => ({ type: role[0], targetId: role[1] }));
    this.setKlass(klass);
  }

  setKlass(klass) {
    switch (klass) {
      case 'equiv':
        this.equiv = true;
        break;
      case 'relation':
        this.relation = true;
        break;
      default:
        break;
    }
  }
}

class Chunk {
  constructor(index, text, from, to, space) {
    this.index = index;
    this.text = text;
    this.from = from;
    this.to = to;
    this.space = space;
    this.fragments = [];
  }
  find(chunk,chunkId){
    return chunk.find(c=>c.chunkId===chunkId)
  }
}

class Annotation {
  constructor(text) {
    this.text = text
  }
}

class Arc {
  constructor(eventDesc, role, dist, eventNo) {
    this.origin = eventDesc.id;
    this.target = role.targetId;
    this.dist = dist;
    this.type = role.type;
    this.jumpHeight = 0;
    this.setEventDescType(eventDesc, eventNo);
  }

  setEventDescType(eventDesc, eventNo) {
    if (eventDesc.equiv) {
      this.equiv = true;
      this.eventDescId = eventNo;
      eventDesc.equivArc = this;
    } else if (eventDesc.relation) {
      this.relation = true;
      this.eventDescId = eventNo;
    }
  }
}

class Row {
  constructor(svg) {
    this.group = svg.group();
    this.background = this.group.group();
    this.chunks = [];
    this.hasAnnotations = false;
    this.maxArcHeight = 0;
    this.maxSpanHeight = 0;
  }
}

export { DocumentData, Span, EventDesc, Chunk, Arc, Row };



