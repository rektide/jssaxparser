/*
Copyright or � or Copr. Nicolas Debeissat Brett Zamir

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

/* sax 2 methods
 void 	attributeDecl(java.lang.String eName, java.lang.String aName, java.lang.String type, java.lang.String mode, java.lang.String value)
          Report an attribute type declaration.
 void 	comment(char[] ch, int start, int length)
          Report an XML comment anywhere in the document.
 void 	elementDecl(java.lang.String name, java.lang.String model)
          Report an element type declaration.
 void 	endCDATA()
          Report the end of a CDATA section.
 void 	endDTD()
          Report the end of DTD declarations.
 void 	endEntity(java.lang.String name)
          Report the end of an entity.
 void 	externalEntityDecl(java.lang.String name, java.lang.String publicId, java.lang.String systemId)
          Report a parsed external entity declaration.
 InputSource 	getExternalSubset(java.lang.String name, java.lang.String baseURI)
          Tells the parser that if no external subset has been declared in the document text, none should be used.
 void 	internalEntityDecl(java.lang.String name, java.lang.String value)
          Report an internal entity declaration.
 InputSource 	resolveEntity(java.lang.String publicId, java.lang.String systemId)
          Invokes EntityResolver2.resolveEntity() with null entity name and base URI.
 InputSource 	resolveEntity(java.lang.String name, java.lang.String publicId, java.lang.String baseURI, java.lang.String systemId)
          Tells the parser to resolve the systemId against the baseURI and read the entity text from that resulting absolute URI.
 void 	startCDATA()
          Report the start of a CDATA section.
 void 	startDTD(java.lang.String name, java.lang.String publicId, java.lang.String systemId)
          Report the start of DTD declarations, if any.
 void 	startEntity(java.lang.String name)
          Report the beginning of some internal and external XML entities.
*/
DomContentHandler.prototype.attributeDecl(eName, aName, type, mode, value) {};

DomContentHandler.prototype.comment(ch, start, length) {};

DomContentHandler.prototype.elementDecl(name, model) {};

DomContentHandler.prototype.endCDATA() {};

DomContentHandler.prototype.endDTD() {};

DomContentHandler.prototype.endEntity(name) {};

DomContentHandler.prototype.externalEntityDecl(name, publicId, systemId) {};

DomContentHandler.prototype.getExternalSubset(name, baseURI) {};

DomContentHandler.prototype.internalEntityDecl(name, value) {};

//DomContentHandler.prototype.resolveEntity(publicId, systemId) {};
DomContentHandler.prototype.resolveEntity(name, publicId, baseURI, systemId) {};

DomContentHandler.prototype.startCDATA() {};

DomContentHandler.prototype.startDTD(name, publicId, systemId) {};

DomContentHandler.prototype.startEntity(name) {};


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