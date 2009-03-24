/*
Copyright or © or Copr. Nicolas Debeissat Brett Zamir

nicolas.debeissat@gmail.com (http://debeissat.nicolas.free.fr/) brettz9@yahoo.com

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

function DomContentHandler() {
    this.saxExceptions = [];
}
DomContentHandler.prototype.startDocument = function() {
    this.document = createDocument();
};
DomContentHandler.prototype.startElement = function(namespaceURI, localName, qName, atts) {
    var element;
    if (namespaceURI == '') {
        element = this.document.createElement(localName);
    } else {
        element = this.document.createElementNS(namespaceURI, qName);
    }
    if (!this.currentElement) {
        this.document.appendChild(element);
    } else {
        this.currentElement.appendChild(element);
    }
    this.currentElement = element;
    this.addAtts(atts);
};
DomContentHandler.prototype.endElement = function(namespaceURI, localName, qName) {
    this.currentElement = this.currentElement.parentNode;
};
DomContentHandler.prototype.startPrefixMapping = function(prefix, uri) {
    /*
    if (this.currentElement.setAttributeNS) {
        this.currentElement.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:" + prefix, uri);
    }
    */
};
DomContentHandler.prototype.endPrefixMapping = function(prefix) {
};
DomContentHandler.prototype.processingInstruction = function(target, data) {
};
DomContentHandler.prototype.ignorableWhitespace = function(ch, start, length) {
};
DomContentHandler.prototype.characters = function(ch, start, length) {
    var textNode = this.document.createTextNode(ch);
    this.currentElement.appendChild(textNode);
};
DomContentHandler.prototype.skippedEntity = function(name) {
};
DomContentHandler.prototype.endDocument = function() {
};
DomContentHandler.prototype.addAtts = function(atts) {
    for (var i = 0 ; i < atts.getLength() ; i++) {
        var namespaceURI = atts.getURI(i);
        var value = atts.getValue(i);
        if (namespaceURI == '') {
            var localName = atts.getLocalName(i);
            this.currentElement.setAttribute(localName, value);
        } else {
            var qName = atts.getQName(i);
            this.currentElement.setAttributeNS(namespaceURI, qName, value);
        }
    }
};
DomContentHandler.prototype.warning = function(saxException) {
    this.saxExceptions.push(saxException);
};
DomContentHandler.prototype.error = function(saxException) {
    this.saxExceptions.push(saxException);
};
DomContentHandler.prototype.fatalError = function(saxException) {
    throw saxException;
};


function createDocument() {
    // code for IE
    if (window.ActiveXObject) {
        var doc = new ActiveXObject("Microsoft.XMLDOM");
        doc.async = "false";
    }
    // code for Mozilla, Firefox
    else {
        var doc = document.implementation.createDocument("", "", null);
    }
    return doc;
}