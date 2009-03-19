/*
Copyright or © or Copr. Nicolas Debeissat

nicolas.debeissat@gmail.com (http://debeissat.nicolas.free.fr/)

This software is a computer program whose purpose is to parse XML
files respecting SAX2 specifications.

This software is governed by the CeCILL license under French law and
abiding by the rules of distribution of free software.  You can  use, 
modify and/ or redistribute the software under the terms of the CeCILL
license as circulated by CEA, CNRS and INRIA at the following URL
"http://www.cecill.info". 

As a counterpart to the access to the source code and  rights to copy,
modify and redistribute granted by the license, users are provided only
with a limited warranty  and the software's author,  the holder of the
economic rights,  and the successive licensors  have only  limited
liability. 

In this respect, the user's attention is drawn to the risks associated
with loading,  using,  modifying and/or developing or reproducing the
software by the user in light of its specific status of free software,
that may mean  that it is complicated to manipulate,  and  that  also
therefore means  that it is reserved for developers  and  experienced
professionals having in-depth computer knowledge. Users are therefore
encouraged to load and test the software's suitability as regards their
requirements in conditions enabling the security of their systems and/or 
data to be ensured and,  more generally, to use and operate it in the 
same conditions as regards security. 

The fact that you are presently reading this means that you have had
knowledge of the CeCILL license and that you accept its terms.

*/

function DummyContentHandler(div) {
    
    this.div = div;
    
}
DummyContentHandler.prototype.startDocument = function() {
    this.div.innerHTML += "startDocument<br/>";
};

DummyContentHandler.prototype.startElement = function(namespaceURI, localName, qName, atts) {
    this.div.innerHTML += "startElement [" + namespaceURI + "] [" + localName + "] [" + qName + "]<br/>";
    this.displayAtts(atts);
};

DummyContentHandler.prototype.endElement = function(namespaceURI, localName, qName) {
    this.div.innerHTML += "endElement [" + namespaceURI + "] [" + localName + "] [" + qName + "]<br/>";
};

DummyContentHandler.prototype.startPrefixMapping = function(prefix, uri) {
    this.div.innerHTML += "startPrefixMapping [" + prefix + "] [" + uri + "]<br/>";
};

DummyContentHandler.prototype.endPrefixMapping = function(prefix) {
    this.div.innerHTML += "endPrefixMapping [" + prefix + "]<br/>";
};

DummyContentHandler.prototype.processingInstruction = function(target, data) {
    this.div.innerHTML += "processingInstruction [" + target + "] [" + data + "]<br/>";
};

DummyContentHandler.prototype.ignorableWhitespace = function(ch, start, length) {
    this.div.innerHTML += "ignorableWhitespace [" + ch + "] [" + start + "] [" + length + "]<br/>";
};

DummyContentHandler.prototype.characters = function(ch, start, length) {
    this.div.innerHTML += "characters [" + ch + "] [" + start + "] [" + length + "]<br/>";
};

DummyContentHandler.prototype.skippedEntity = function(name) {
    this.div.innerHTML += "skippedEntity [" + name + "]<br/>";
};

DummyContentHandler.prototype.endDocument = function() {
    this.div.innerHTML += "endDocument";
};

DummyContentHandler.prototype.displayAtts = function(atts) {
    for (var i = 0 ; i < atts.getLength() ; i++) {
        this.div.innerHTML += "attribute [" + atts.getURI(i) + "] [" + atts.getLocalName(i) + "] [" + atts.getValue(i) + "]<br/>";
    }
};

DummyContentHandler.prototype.warning = function(saxException) {
    this.serializeSaxException(saxException);
};
DummyContentHandler.prototype.error = function(saxException) {
    this.serializeSaxException(saxException);
};
DummyContentHandler.prototype.fatalError = function(saxException) {
    this.serializeSaxException(saxException);
};

DummyContentHandler.prototype.serializeSaxException = function(saxException) {
    this.div.innerHTML += "invalid char : [" + saxException.ch + "] at index : " + saxException.index + "<br/>";
    this.div.innerHTML += "message is : [" + saxException.message + "]<br/>";
    if (saxException.exception) {
        this.div.innerHTML += "wrapped exception is : [" + this.serializeSaxException(saxException.exception) + "]<br/>";
    }
}
