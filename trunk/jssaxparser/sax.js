/*
Copyright or � or Copr. Nicolas Debeissat, Brett Zamir

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

// NOTE: We have at least a skeleton for all non-deprecated, non-adapter SAX2 classes/interfaces/exceptions,
// except for InputSource: http://www.saxproject.org/apidoc/org/xml/sax/InputSource.html which works largely
// with streams; we use our own parseString() instead of XMLReader's parse() which expects the InputSouce (or
// systemId); note that resolveEntity() on EntityResolver and also getExternalSubset() on EntityResolver2 return
// an InputSource; Locator and Locator2 also have notes on InputSource

(function () { // Begin namespace

var that = this; // probably window object


/* Private static variables (constant) */

/* XML Name regular expressions */
var NAME_START_CHAR = ":A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u0200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\ud800-\udb7f\udc00-\udfff"; // The last two ranges are for surrogates that comprise #x10000-#xEFFFF
var NAME_END_CHAR = ".0-9\u00B7\u0300-\u036F\u203F-\u2040-"; // Don't need escaping since to be put in a character class
var NOT_START_OR_END_CHAR = new RegExp("[^" + NAME_START_CHAR + NAME_END_CHAR + "]");

var WS = /\s/; // Fix: verify \s is XML whitespace, and allowable in all places using this expression

/* Scanner states  */
var STATE_XML_DECL                  =  0;
var STATE_PROLOG                    =  1;
var STATE_PROLOG_DOCTYPE_DECLARED   =  2;
var STATE_ROOT_ELEMENT              =  3;
var STATE_CONTENT                   =  4;
var STATE_TRAILING_MISC             =  5;

/* Error values */
var WARNING = "W";
var ERROR = "E";
var FATAL = "F";



/* Supporting functions and exceptions */

// UNUSED and IMPLEMENTED
/*
FIELDS
static java.lang.String 	NSDECL
          The namespace declaration URI as a constant.
static java.lang.String 	XMLNS
          The XML Namespace URI as a constant.

Method Summary
 boolean 	declarePrefix(java.lang.String prefix, java.lang.String uri)
          Declare a Namespace prefix.
 java.util.Enumeration 	getDeclaredPrefixes()
          Return an enumeration of all prefixes declared in this context.
 java.lang.String 	getPrefix(java.lang.String uri)
          Return one of the prefixes mapped to a Namespace URI.
 java.util.Enumeration 	getPrefixes()
          Return an enumeration of all prefixes whose declarations are active in the current context.
 java.util.Enumeration 	getPrefixes(java.lang.String uri)
          Return an enumeration of all prefixes for a given URI whose declarations are active in the current context.
 java.lang.String 	getURI(java.lang.String prefix)
          Look up a prefix and get the currently-mapped Namespace URI.
 boolean 	isNamespaceDeclUris()
          Returns true if namespace declaration attributes are placed into a namespace.
 void 	popContext()
          Revert to the previous Namespace context.
 java.lang.String[] 	processName(java.lang.String qName, java.lang.String[] parts, boolean isAttribute)
          Process a raw XML qualified name, after all declarations in the current context have been handled by declarePrefix().
 void 	pushContext()
          Start a new Namespace context.
 void 	reset()
          Reset this Namespace support object for reuse.
 void 	setNamespaceDeclUris(boolean value)
          Controls whether namespace declaration attributes are placed into the NSDECL namespace by processName().
 **/
// Note: Try to adapt for internal use, as well as offer for external app
// http://www.saxproject.org/apidoc/org/xml/sax/helpers/NamespaceSupport.html
function NamespaceSupport () {
    throw 'NamespaceSupport is not presently implemented';
}
NamespaceSupport.prototype.declarePrefix = function (prefix, uri) {

};
NamespaceSupport.prototype.getDeclaredPrefixes = function () {

};
NamespaceSupport.prototype.getPrefix = function (uri) {

};
NamespaceSupport.prototype.getPrefixes = function () {

};
NamespaceSupport.prototype.getPrefixes = function (uri) {

};
NamespaceSupport.prototype.getURI = function (prefix) {

};
NamespaceSupport.prototype.isNamespaceDeclUris = function () {

};
NamespaceSupport.prototype.popContext = function () {

};
NamespaceSupport.prototype.processName = function (qName, parts, isAttribute) {

};
NamespaceSupport.prototype.pushContext = function () {

};
NamespaceSupport.prototype.reset = function () {

};
NamespaceSupport.prototype.setNamespaceDeclUris = function (value) {

};



// http://www.saxproject.org/apidoc/org/xml/sax/SAXException.html
function SAXException(message, exception) { // java.lang.Exception
    this.message = message;
    this.exception = exception;
}
SAXException.prototype = new Error(); // We try to make useful as a JavaScript error, though we could even implement java.lang.Exception
SAXException.constructor = SAXException;
SAXException.prototype.getMessage = function () {
    return this.message;
};
SAXException.prototype.getException = function () {
    return this.exception;
};

// Not fully implemented
// http://www.saxproject.org/apidoc/org/xml/sax/SAXNotSupportedException.html
function SAXNotSupportedException (msg) { // java.lang.Exception
    this.message = msg || '';
}
SAXNotSupportedException.prototype = new SAXException();
SAXNotSupportedException.constructor = SAXNotSupportedException;

// http://www.saxproject.org/apidoc/org/xml/sax/SAXNotRecognizedException.html
function SAXNotRecognizedException (msg) { // java.lang.Exception
    this.message = msg || '';
}
SAXNotRecognizedException.prototype = new SAXException();
SAXNotRecognizedException.constructor = SAXNotRecognizedException;

//This constructor is more complex and not presently implemented;
//  see Java API to implement additional arguments correctly
// http://www.saxproject.org/apidoc/org/xml/sax/SAXParseException.html
function SAXParseException (msg) { // java.lang.Exception //
    this.message = msg || '';
}
SAXParseException.prototype = new SAXException();
SAXParseException.constructor = SAXParseException;

// Our own exception; should this perhaps extend SAXParseException?
function EndOfInputException() {}


// Make these private unless they are based on an interface?
function Sax_Attribute(qName, namespaceURI, value) {
    this.qName = qName;
    this.namespaceURI = namespaceURI;
    this.value = value;
}

function Sax_QName(prefix, localName) {
    this.prefix = prefix;
    this.localName = localName;
    if (prefix !== "") {
        this.qName = prefix + ":" + localName;
    } else {
        this.qName = localName;
    }
}
Sax_QName.prototype.equals = function(qName) {
    return this.qName === qName.qName;
};

/*
 int 	getIndex(java.lang.String qName)
          Look up the index of an attribute by XML qualified (prefixed) name.
 int 	getIndex(java.lang.String uri, java.lang.String localName)
          Look up the index of an attribute by Namespace name.
 int 	getLength()
          Return the number of attributes in the list.
 java.lang.String 	getLocalName(int index)
          Look up an attribute's local name by index.
 java.lang.String 	getQName(int index)
          Look up an attribute's XML qualified (prefixed) name by index.
 java.lang.String 	getType(int index)
          Look up an attribute's type by index.
 java.lang.String 	getType(java.lang.String qName)
          Look up an attribute's type by XML qualified (prefixed) name.
 java.lang.String 	getType(java.lang.String uri, java.lang.String localName)
          Look up an attribute's type by Namespace name.
 java.lang.String 	getURI(int index)
          Look up an attribute's Namespace URI by index.
 java.lang.String 	getValue(int index)
          Look up an attribute's value by index.
 java.lang.String 	getValue(java.lang.String qName)
          Look up an attribute's value by XML qualified (prefixed) name.
 java.lang.String 	getValue(java.lang.String uri, java.lang.String localName)
          Look up an attribute's value by Namespace name.
 */

// Private helpers for AttributesImpl (private static treated as private instance below)
function _getIndexByQName(qName) {
    for (var i in this.attsArray) {
        if (this.attsArray[i].qName.equals(qName)) {
            return i;
        }
    }
    return -1;
}
function _getIndexByURI(uri, localName) {
    for (var i in this.attsArray) {
        if (this.attsArray[i].namespaceURI === uri && this.attsArray[i].qName.localName === localName) {
            return i;
        }
    }
    return -1;
}
function _getValueByIndex(index) {
    return this.attsArray[index].value;
}
function _getValueByQName(qName) {
    for (var i in this.attsArray) {
        if (this.attsArray[i].qName.equals(qName)) {
            return this.attsArray[i].value;
        }
    }
}
function _getValueByURI(uri, localName) {
    for (var i in this.attsArray) {
        if (this.attsArray[i].namespaceURI === uri && this.attsArray[i].qName.localName === localName) {
            return this.attsArray[i].value;
        }
    }
}


// INCOMPLETE
// http://www.saxproject.org/apidoc/org/xml/sax/helpers/AttributesImpl.html
function AttributesImpl(attsArray) {
    this.attsArray = attsArray;
}
// INTERFACE: Attributes: http://www.saxproject.org/apidoc/org/xml/sax/Attributes.html
AttributesImpl.prototype.getIndex = function(arg1, arg2) {
    if (arg2 === undefined) {
        return _getIndexByQName.call(this, arg1);
    } else {
        return _getIndexByURI.call(this, arg1, arg2);
    }
};
AttributesImpl.prototype.getLength = function() {
    return this.attsArray.length;
};
AttributesImpl.prototype.getLocalName = function(index) {
    return this.attsArray[index].qName.localName;
};
AttributesImpl.prototype.getQName = function(index) {
    return this.attsArray[index].qName.qName;
};
//not supported
AttributesImpl.prototype.getType = function(arg1, arg2) { // Should allow 1-2 arguments of different types: idnex or qName or uri+localName
    // Besides CDATA (default when not supported), could return "ID", "IDREF", "IDREFS", "NMTOKEN", "NMTOKENS", "ENTITY", "ENTITIES", or "NOTATION" (always in upper case).
    // "For an enumerated attribute that is not a notation, the parser will report the type as 'NMTOKEN'."
    // If uri and localName passed, should return the "attribute type as a string, or null if the attribute is not in the list or if Namespace processing is not being performed."
    // If qName passed, should return the "attribute type as a string, or null if the attribute is not in the list or if qualified names are not available."
    return "CDATA";
};
AttributesImpl.prototype.getURI = function(index) {
    return this.attsArray[index].namespaceURI;
};
AttributesImpl.prototype.getValue = function(arg1, arg2) {
    if (arg2 === undefined) {
        if (typeof arg1 === "string") {
            return _getValueByQName.call(this, arg1);
        } else {
            return _getValueByIndex.call(this, arg1);
        }
    } else {
        return _getValueByURI.call(this, arg1, arg2);
    }
};
// Other AttributesImpl methods
AttributesImpl.prototype.addAttribute = function (uri, localName, qName, type, value) {

};
AttributesImpl.prototype.clear = function () {

};
AttributesImpl.prototype.removeAttribute = function (index) {};
AttributesImpl.prototype.setAttribute = function (index, uri, localName, qName, type, value) {};
AttributesImpl.prototype.setAttributes = function (atts) {};
AttributesImpl.prototype.setLocalName = function (index, localName) {};
AttributesImpl.prototype.setQName = function (index, qName) {};
AttributesImpl.prototype.setType = function (index, type) {};
AttributesImpl.prototype.setURI = function (index, uri) {};
AttributesImpl.prototype.setValue = function (index, value) {};


/*
Attributes2Impl()
          Construct a new, empty Attributes2Impl object.
Attributes2Impl(Attributes atts)
          Copy an existing Attributes or Attributes2 object.
*/
// http://www.saxproject.org/apidoc/org/xml/sax/ext/Attributes2Impl.html
// When implemented, use this attribute class if this.features['http://xml.org/sax/features/use-attributes2'] is true
function Attributes2Impl (atts) {
    if (atts) {}
    throw 'Attributes2Impl is presently unimplemented';
}
Attributes2Impl.prototype = new AttributesImpl();

// INTERFACE: Attributes2: http://www.saxproject.org/apidoc/org/xml/sax/ext/Attributes2.html
/*
 boolean 	isDeclared(int index)
          Returns false unless the attribute was declared in the DTD.
 boolean 	isDeclared(java.lang.String qName)
          Returns false unless the attribute was declared in the DTD.
 boolean 	isDeclared(java.lang.String uri, java.lang.String localName)
          Returns false unless the attribute was declared in the DTD.
 boolean 	isSpecified(int index)
          Returns true unless the attribute value was provided by DTD defaulting.
 boolean 	isSpecified(java.lang.String qName)
          Returns true unless the attribute value was provided by DTD defaulting.
 boolean 	isSpecified(java.lang.String uri, java.lang.String localName)
          Returns true unless the attribute value was provided by DTD defaulting.
*/
Attributes2Impl.prototype.isDeclared = function (indexOrQNameOrURI, localName) {
};
Attributes2Impl.prototype.isSpecified = function (indexOrQNameOrURI, localName) {
};
// Other Attributes2Impl methods
/*
 void 	addAttribute(java.lang.String uri, java.lang.String localName, java.lang.String qName, java.lang.String type, java.lang.String value)
          Add an attribute to the end of the list, setting its "specified" flag to true.
void 	removeAttribute(int index)
          Remove an attribute from the list.
 void 	setAttributes(Attributes atts)
          Copy an entire Attributes object.
 void 	setDeclared(int index, boolean value)
          Assign a value to the "declared" flag of a specific attribute.
 void 	setSpecified(int index, boolean value)
          Assign a value to the "specified" flag of a specific attribute.
 **/
Attributes2Impl.prototype.addAttribute = function (uri, localName, qName, type, value) {
};
Attributes2Impl.prototype.removeAttribute = function (index) {
};
Attributes2Impl.prototype.setAttributes = function (atts) {
};
Attributes2Impl.prototype.setDeclared = function (index, value) {
};
Attributes2Impl.prototype.setSpecified = function (index, value) {
};



// The official SAX2 parse() method is not implemented (that can either accept an InputSource object or systemId string;
//    for now the parseString() method can be used (and is more convenient than converting to an InputSource object).
// The feature/property defaults are incomplete, as they really depend on the implementation and how far we
//   implement them; however, we've added defaults, two of which (on namespaces) are required to be
//   supported (though they don't need to support both true and false options).
// FURTHER NOTES:
// 1) the only meaningful methods at the moment are: 
//  getProperty(), setProperty() (presently only for declarationHandler and lexicalHandler),
//  getContentHandler(), setContentHandler(),
//  getErrorHandler(), setErrorHandler(), and
//  our own parseString().
// 2) No property should be retrieved or set publicly.
// 3) The SAXParser constructor currently only works with these arguments: first (partially), second, and fourth (partially)

// Currently does not call the following (as does the DefaultHandler2 class)
// 1) on the contentHandler: ignorableWhitespace(), skippedEntity(), setDocumentLocator() (including with Locator2)
// 2) on the DeclHandler: attributeDecl(), elementDecl(), externalEntityDecl()
// 3) on EntityResolver: resolveEntity()
// 4) on EntityResolver2: resolveEntity() (additional args) or getExternalSubset()
// 5) on DTDHandler: notationDecl(), unparsedEntityDecl()
// lexicalHandler and errorHandler interface methods, however, are all supported
// Need to also implement Attributes2 in startElement (rename AttributesImpl to Attributes2Impl and add interface)

function SAXParser (contentHandler, lexicalHandler, errorHandler, declarationHandler, dtdHandler, domNode) {
    // Implements SAX2 XMLReader interface (except for parse() methods); also add http://www.saxproject.org/apidoc/org/xml/sax/helpers/XMLFilterImpl.html ?
    // Since SAX2 doesn't specify constructors, this class is able to define its own behavior to accept a contentHandler, etc.

    this.contentHandler = contentHandler;
    this.dtdHandler = dtdHandler;
    this.errorHandler = errorHandler;
    this.entityResolver = null;

    this.disallowedGetProperty = [];
    this.disallowedGetFeature = [];
    this.disallowedSetProperty = [];
    this.disallowedSetFeature = [];

    this.disallowedSetPropertyValues = {};
    this.disallowedSetFeatureValues = {};

    // For official features and properties, see http://www.saxproject.org/apidoc/org/xml/sax/package-summary.html#package_description
    // We can define our own as well
    this.features = {}; // Boolean values
    this.features['http://xml.org/sax/features/external-general-entities'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/external-parameter-entities'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/is-standalone'] = undefined; // Can only be set during parsing
    this.features['http://xml.org/sax/features/lexical-handler/parameter-entities'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/namespaces'] = true; // must support true
    this.features['http://xml.org/sax/features/namespace-prefixes'] = false; // must support false
    this.features['http://xml.org/sax/features/resolve-dtd-uris'] = true;
    this.features['http://xml.org/sax/features/string-interning'] = true; // Make safe to treat string literals as identical to String()
    this.features['http://xml.org/sax/features/unicode-normalization-checking'] = false;
    this.features['http://xml.org/sax/features/use-attributes2'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/use-locator2'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/use-entity-resolver2'] = true;
    this.features['http://xml.org/sax/features/validation'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/xmlns-uris'] = false;
    this.features['http://xml.org/sax/features/xml-1.1'] = false; // Not supported yet

    this.properties = {}; // objects
    this.properties['http://xml.org/sax/properties/declaration-handler'] = this.declarationHandler = declarationHandler;
    this.properties['http://xml.org/sax/properties/document-xml-version'] = this.documentXmlVersion = null;
    this.properties['http://xml.org/sax/properties/dom-node'] = this.domNode = domNode;
    this.properties['http://xml.org/sax/properties/lexical-handler'] = this.lexicalHandler = lexicalHandler || null;
    this.properties['http://xml.org/sax/properties/xml-string'] = this.xmlString = null;


    // IMPLEMENTATION-DEPENDENT PROPERTIES TO SUPPORT PARSING
    this.index = -1;

    this.state = STATE_XML_DECL;

    this.elementsStack = []; // Is it necessary to redo this below too?
    /* for each depth, a map of namespaces */
    this.namespaces = []; // Is it necessary to redo this below too?
    /* map between entity names and values */
    this.entities = []; // Is it necessary to redo this below too?
}

// BEGIN SAX2 XMLReader INTERFACE
SAXParser.prototype.getContentHandler = function () {
    // Return the current content handler (ContentHandler).
    return this.contentHandler;
};
SAXParser.prototype.getDTDHandler = function () {
    // Return the current DTD handler (DTDHandler).
    return this.dtdHandler;
};
SAXParser.prototype.getEntityResolver = function () {
    // Return the current entity resolver (EntityResolver).
    return this.entityResolver;
};
SAXParser.prototype.getErrorHandler = function () {
    // Return the current error handler (ErrorHandler).
    return this.errorHandler;
};
SAXParser.prototype.getFeature = function (name) { // (java.lang.String)
    // Look up the value of a feature flag (boolean).
    if (this.features[name] === undefined) {
      throw new SAXNotRecognizedException();
    }
    else if (this.disallowedGetFeature.indexOf(name) !== -1) {
      throw new SAXNotSupportedException();
    }
    return this.features[name];
};
SAXParser.prototype.getProperty = function (name) { // (java.lang.String)
    // Look up the value of a property (java.lang.Object).
    // It is possible for an XMLReader to recognize a property name but temporarily be unable to return its value. Some property values may be available only in specific contexts, such as before, during, or after a parse.
    if (this.properties[name] === undefined) {
      throw new SAXNotRecognizedException();
    }
    else if (this.disallowedGetProperty.indexOf(name) !== -1) {
      throw new SAXNotSupportedException();
    }
    return this.properties[name];
};
SAXParser.prototype.parse = function (inputOrSystemId) { // (InputSource input OR java.lang.String systemId)
    // Parse an XML document (void). OR
    // Parse an XML document from a system identifier (URI) (void).
    // may throw java.io.IOException or SAXException
    throw 'Not implemented: at present you must use our non-SAX parseString() method';
};
SAXParser.prototype.setContentHandler = function (handler) { // (ContentHandler)
    // Allow an application to register a content event handler (void).
    this.contentHandler = handler;
};
SAXParser.prototype.setDTDHandler = function (handler) { // (DTDHandler)
    // Allow an application to register a DTD event handler (void).
    this.dtdHandler = handler;
};
SAXParser.prototype.setEntityResolver = function (resolver) { // (EntityResolver)
    // Allow an application to register an entity resolver (void).
    this.entityResolver = resolver;
};
SAXParser.prototype.setErrorHandler = function (handler) { // (ErrorHandler)
    // Allow an application to register an error event handler (void).
    this.errorHandler = handler;
};
SAXParser.prototype.setFeature = function (name, value) { // (java.lang.String, boolean)
    // Set the value of a feature flag (void).
    if (this.features[name] === undefined) { // Should be defined already in some manner
        throw new SAXNotRecognizedException();
    }
    else if (
            (this.disallowedSetFeatureValues[name] !== undefined &&
                    this.disallowedSetFeatureValues[name] === value) ||
                (this.disallowedSetFeature.indexOf(name) !== -1)
            ){
        throw new SAXNotSupportedException();
    }
    this.features[name] = value;
};
SAXParser.prototype.setProperty = function (name, value) { // (java.lang.String, java.lang.Object)
    // Set the value of a property (void).
    // It is possible for an XMLReader to recognize a property name but to be unable to change the current value. Some property values may be immutable or mutable only in specific contexts, such as before, during, or after a parse.
    if (this.properties[name] === undefined) { // Should be defined already in some manner
        throw new SAXNotRecognizedException();
    }
    else if (
                (this.disallowedSetPropertyValues[name] !== undefined &&
                    this.disallowedSetPropertyValues[name] === value) ||
                (this.disallowedSetProperty.indexOf(name) !== -1)
            ){
        throw new SAXNotSupportedException();
    }
    this.properties[name] = value;
};
// END SAX2 XMLReader INTERFACE


// BEGIN CUSTOM API (could make all but parseString() private)
SAXParser.prototype.parseString = function(xml) { // We implement our own for now, but should probably call the standard parse() which requires an InputSource object (or systemId string)
    this.xml = xml;
    this.length = xml.length;
    this.index = 0;
    this.ch = this.xml.charAt(this.index);
    this.state = STATE_XML_DECL;
    this.elementsStack = [];
    this.namespaces = [];
    this.entities = [];
    this.contentHandler.startDocument();
    try {
        while (this.index < this.length) {
            this.next();
        }
        throw new EndOfInputException();
    } catch(e) {
        if (e instanceof SAXParseException) {
            this.errorHandler.fatalError(e);
        } else if (e instanceof EndOfInputException) {
            if (this.elementsStack.length > 0) {
                this.fireError("the markup " + this.elementsStack.pop() + " has not been closed", FATAL);
            } else {
                try {
                    this.contentHandler.endDocument();
                } catch(e2) {}
            }
        }
    }
};

SAXParser.prototype.next = function() {
    this.skipWhiteSpaces();
    if (this.ch === ">") {
        this.nextChar();
    } else if (this.ch === "<") {
        this.nextChar();
        this.scanLT();
    } else if (this.elementsStack.length > 0) {
        this.scanText();
    //if elementsStack is empty it is text misplaced
    } else {
        this.fireError("can not have text at root level of the XML", FATAL);
    }
};



// [1] document ::= prolog element Misc*
//
// [22] prolog ::= XMLDecl? Misc* (doctypedecl Misc*)?
// [23] XMLDecl ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'
// [24] VersionInfo ::= S 'version' Eq (' VersionNum ' | " VersionNum ")
//
// The beginning of XMLDecl simplifies to:
//    '<?xml' S ...
//
// [27] Misc ::= Comment | PI |  S
// [15] Comment ::= '<!--' ((Char - '-') | ('-' (Char - '-')))* '-->'
// [16] PI ::= '<?' PITarget (S (Char* - (Char* '?>' Char*)))? '?>'
// [17] PITarget ::= Name - (('X' | 'x') ('M' | 'm') ('L' | 'l'))
//
// [28] doctypedecl ::= '<!DOCTYPE' S Name (S ExternalID)? S?
//                      ('[' (markupdecl | PEReference | S)* ']' S?)? '>'
//
//White Space
// [3] S ::=(#x20 | #x9 | #xD | #xA)+
SAXParser.prototype.scanLT = function() {
    if (this.state === STATE_XML_DECL) {
        if (!this.scanXMLDeclOrTextDecl()) {
            this.state = STATE_PROLOG;
            this.scanLT();
        } else {
            //if it was a XMLDecl (only one XMLDecl is permitted)
            this.state = STATE_PROLOG;
        }
    } else if (this.state === STATE_PROLOG) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                this.scanDoctypeDecl();
                this.state = STATE_PROLOG_DOCTYPE_DECLARED;
            }
        } else if (this.ch === "?") {
            this.nextChar(true);
            this.scanPI();
        } else {
            this.state = STATE_ROOT_ELEMENT;
            //does not go to next char exiting the method
            this.scanLT();
        }
    } else if (this.state === STATE_PROLOG_DOCTYPE_DECLARED) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                this.fireError("can not have two doctype declarations", FATAL);
            }
        } else if (this.ch === "?") {
            this.nextChar(true);
            this.scanPI();
        } else {
            this.state = STATE_ROOT_ELEMENT;
            //does not go to next char exiting the method
            this.scanLT();
        }
    } else if (this.state === STATE_ROOT_ELEMENT) {
        if (this.scanMarkup()) {
            this.state = STATE_CONTENT;
        } else {
            this.state = STATE_TRAILING_MISC;
        }
    } else if (this.state === STATE_CONTENT) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                if (!this.scanCData()) {
                    this.fireError("neither comment nor CDATA after &lt;!", FATAL);
                }
            }
        } else if (this.ch === "?") {
            this.nextChar();
            this.scanPI();
        } else if (this.ch === "/") {
            this.nextChar();
            if (this.scanEndingTag()) {
                if (this.elementsStack.length === 0) {
                    this.state = STATE_TRAILING_MISC;
                }
            }
        } else {
            if (!this.scanMarkup()) {
                this.fireError("not a valid markup", FATAL);
            }
        }
    } else if (this.state === STATE_TRAILING_MISC) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                this.fireError("end of document, only comments or processing instructions are allowed", FATAL);
            }
        } else if (this.ch === "?") {
            this.nextChar();
            if (!this.scanPI()) {
                this.fireError("end of document, only comment or processing instruction are allowed", FATAL);
            }
        }
    }
};


// 14]   	CharData ::= [^<&]* - ([^<&]* ']]>' [^<&]*)
//  what I understand from there : http://www.w3.org/TR/REC-xml/#dt-chardata is that & is allowed
// in character data only if it is an entity reference
SAXParser.prototype.scanText = function() {
    var start = this.index;
    var content = this.nextRegExp(/[<&]/);
    
    //if found a "&"
    while (this.ch === "&") {
        this.nextChar(true);
        var ref = this.scanRef();
        content += ref;
        content += this.nextRegExp(/[<&]/);
    }
    var length = this.index - start;
    this.contentHandler.characters(content, start, length);
};


//current char is after '&'
SAXParser.prototype.scanRef = function() {
    var ref;
    if (this.ch === "#") {
        this.nextChar(true);
        ref = this.scanCharRef();
    } else {
        ref = this.scanEntityRef();
    }
    //current char is ";"
    this.nextChar(true);
    return ref;
};


// [15] Comment ::= '<!--' ((Char - '-') | ('-' (Char - '-')))* '-->'
SAXParser.prototype.scanComment = function() {
    if (this.ch === "-") {
        this.nextChar(true);
        if (this.ch === "-") {
            //do not skip white space at beginning of comment
            this.nextChar(true);
            var start = this.index;
            var comment = this.nextRegExp(/--/);
            var length = this.index - start;
            //goes to second '-'
            this.nextChar(true);
            this.nextChar(true);
            //must be '>'
            if (this.ch === ">") {
                if (this.lexicalHandler) {
                    this.lexicalHandler.comment(comment, start, length);// Brett (test for support and change start/length?)
                }
                this.nextChar(true);
                return true;
            } else {
                this.fireError("end of comment not valid, must be --&gt;", FATAL);
            }
        } else {
            this.fireError("beginning comment markup is invalid, must be &lt;!--", FATAL);
        }
    } else {
        // can be a doctype
        return false;
    }
};


// [23] XMLDecl ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'
// [24] VersionInfo ::= S 'version' Eq (' VersionNum ' | " VersionNum ")
// [80] EncodingDecl ::= S 'encoding' Eq ('"' EncName '"' |  "'" EncName "'" )
// [81] EncName ::= [A-Za-z] ([A-Za-z0-9._] | '-')*
// [32] SDDecl ::= S 'standalone' Eq (("'" ('yes' | 'no') "'")
//                 | ('"' ('yes' | 'no') '"'))
//
// [77] TextDecl ::= '<?xml' VersionInfo? EncodingDecl S? '?>'
SAXParser.prototype.scanXMLDeclOrTextDecl = function() {
    if (this.xml.substr(this.index, 5) === "?xml ") {
        // Fix: Check for standalone/version and and report as features; version and encoding can be given to Locator2
        this.nextGT();
        return true;
    } else {
        return false;
    }
};


// [16] PI ::= '<?' PITarget (S (Char* - (Char* '?>' Char*)))? '?>'
// [17] PITarget ::= Name - (('X' | 'x') ('M' | 'm') ('L' | 'l'))
SAXParser.prototype.scanPI = function() {
    this.contentHandler.processingInstruction(this.nextName(), this.nextEndPI());
    return true;
};


//[28]   	doctypedecl	   ::=   	'<!DOCTYPE' S  Name (S  ExternalID)? S? ('[' intSubset ']' S?)? '>'
//[28a]   	DeclSep	   ::=   	 PEReference | S
//[28b]   	intSubset	   ::=   	(markupdecl | DeclSep)*
//[29]   	markupdecl	   ::=   	elementdecl | AttlistDecl | EntityDecl | NotationDecl | PI | Comment 
//[75]   	ExternalID	   ::=   	'SYSTEM' S  SystemLiteral
//			| 'PUBLIC' S PubidLiteral S SystemLiteral 
SAXParser.prototype.scanDoctypeDecl = function() {
    if (this.isFollowedBy("DOCTYPE")) {
        this.nextChar();
        var name = this.nextRegExp(/[ \[>]/);
        var systemLiteral;
        if (WS.test(this.ch)) {
            this.nextChar();
            //if there is an externalId
            if (this.isFollowedBy("SYSTEM")) {
                this.nextChar();
                systemLiteral = this.quoteContent();
            } else if (this.isFollowedBy("PUBLIC")) {
                this.nextChar();
                var pubidLiteral = this.quoteContent();
                this.nextChar();
                systemLiteral = this.quoteContent();
            }
            if (WS.test(this.ch)) {
                this.nextChar();
            }
        }
        if (this.lexicalHandler) {
            this.lexicalHandler.startDTD(name, pubidLiteral, systemLiteral);
        }
        if (this.ch === "[") {
            this.nextChar();
            this.scanDoctypeDeclIntSubset();
            this.nextChar();
        }
        if (this.ch !== ">") {
            this.fireError("invalid content in doctype declaration", FATAL);
        }
        if (this.lexicalHandler) {
            this.lexicalHandler.endDTD();
        }
    } else {
        this.fireError("invalid doctype declaration, must be &lt;!DOCTYPE", FATAL);
    }
};

/*
actual char is non whitespace char after '['
[28a]   	DeclSep	   ::=   	 PEReference | S
[28b]   	intSubset	   ::=   	(markupdecl | DeclSep)*
[29]   	markupdecl	   ::=   	 elementdecl | AttlistDecl | EntityDecl | NotationDecl | PI | Comment  
[70]   	EntityDecl	   ::=   	 GEDecl  | PEDecl  
[71]   	          GEDecl	   ::=   	'<!ENTITY' S  Name  S  EntityDef  S? '>'
[72]   	PEDecl	   ::=   	'<!ENTITY' S '%' S Name S PEDef S? '>'
[73]   	EntityDef	   ::=   	 EntityValue  | (ExternalID  NDataDecl?)
[74]   	PEDef	   ::=   	EntityValue | ExternalID 
[9]   	EntityValue	   ::=   	'"' ([^%&"] | PEReference | Reference)* '"'
			|  "'" ([^%&'] | PEReference | Reference)* "'"
[69]   	PEReference	   ::=   	'%' Name ';'
[67]   	Reference	   ::=   	 EntityRef | CharRef
[68]   	EntityRef	   ::=   	'&' Name ';'
[9]   	EntityValue	   ::=   	'"' ([^%&"] | PEReference | Reference)* '"'
			|  "'" ([^%&'] | PEReference | Reference)* "'"
*/
SAXParser.prototype.scanDoctypeDeclIntSubset = function() {
    if (this.ch === "<") {
        this.nextChar(true);
        if (this.ch === "?") {
            this.nextChar();
            if (!this.scanPI()) {
                this.fireError("invalid processing instruction inside doctype declaration", FATAL);
            }
        } else if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                if (this.isFollowedBy("ENTITY")) {
                    this.nextChar();
                    if (this.ch === "%") {
                        //no support for PEDecl
                        this.nextGT();
                    } else {
                        var entityName = this.nextName();
                        this.nextChar();
                        if (this.ch === '"' || this.ch === "'") {
                            var entityValue = this.quoteContent();
                            this.entities[entityName] = entityValue;
                            if (this.declarationHandler) {
                                this.declarationHandler.internalEntityDecl(entityName, entityValue);
                            }
                        } else {
                            //no support for (ExternalID  NDataDecl?)
                            this.nextGT();
                        }
                    }
                } else {
                    //no present support for other declarations
                    this.nextGT();
                }
                if (WS.test(this.ch)) {
                    this.nextChar();
                }
                if (this.ch !== ">") {
                    this.fireError("invalid [29]markupdecl inside doctype declaration, must end with &gt;", FATAL);
                }
                this.nextChar();
            }
        }
    //PEReference
    } else if (this.ch === "%") {
        var name = this.nextRegExp(";");
    }
    if (this.ch !== "]") {
        this.scanDoctypeDeclIntSubset();
    }
};

/*
 [39] element ::= EmptyElemTag | STag content ETag
[44] EmptyElemTag ::= '<' Name (S Attribute)* S? '/>'
[40] STag ::= '<' Name (S Attribute)* S? '>'
[41] Attribute ::= Name Eq AttValue
[10] AttValue ::= '"' ([^<&"] | Reference)* '"' | "'" ([^<&'] | Reference)* "'"
[67] Reference ::= EntityRef | CharRef
[68] EntityRef ::= '&' Name ';'
[66] CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
[43] content ::= (element | CharData | Reference | CDSect | PI | Comment)*
[42] ETag ::= '</' Name S? '>'
[4]  NameChar ::= Letter | Digit | '.' | '-' | '_' | ':' | CombiningChar | Extender
[5]  Name ::= Letter | '_' | ':') (NameChar)*
*/
SAXParser.prototype.scanMarkup = function() {
    var qName = this.getQName();
    this.elementsStack.push(qName.qName);
    this.scanElement(qName);
    return true;
};

SAXParser.prototype.getQName = function() {
    var name = this.nextName();
    var prefix = "";
    var localName = name;
    if (name.indexOf(":") !== -1) {
        var splitResult = name.split(":");
        prefix = splitResult[0];
        localName = splitResult[1];
    }
    return new Sax_QName(prefix, localName);
};

SAXParser.prototype.scanElement = function(qName) {
    var namespacesDeclared = [];
    var atts = this.scanAttributes(namespacesDeclared);
    this.namespaces.push(namespacesDeclared);
    var namespaceURI = this.getNamespaceURI(qName.prefix);
    this.contentHandler.startElement(namespaceURI, qName.localName, qName.qName, atts);
    this.skipWhiteSpaces();
    if (this.ch === "/") {
        this.nextChar(true);
        if (this.ch === ">") {
            this.elementsStack.pop();
            this.endMarkup(namespaceURI, qName);
        } else {
            this.fireError("invalid empty markup, must finish with /&gt;", FATAL);
        }
    }
};

SAXParser.prototype.getNamespaceURI = function(prefix) {
    for (var i in this.namespaces) {
        var namespaceURI = this.namespaces[i][prefix];
        if (namespaceURI) {
            return namespaceURI;
        }
    }
    if (prefix === "") {
        return "";
    }
    this.fireError("prefix " + prefix + " not known in namespaces map", FATAL);
};

SAXParser.prototype.scanAttributes = function(namespacesDeclared) {
    var atts = [];
    this.scanAttribute(atts, namespacesDeclared);
    return new AttributesImpl(atts);
};

SAXParser.prototype.scanAttribute = function(atts, namespacesDeclared) {
    this.skipWhiteSpaces();
    if (this.ch !== ">" && this.ch !== "/") {
        var attQName = this.getQName();
        this.skipWhiteSpaces();
        if (this.ch === "=") {
            this.nextChar();
            // xmlns:bch="http://benchmark"
            if (attQName.prefix === "xmlns") {
                namespacesDeclared[attQName.localName] = this.scanAttValue();
                this.contentHandler.startPrefixMapping(attQName.localName, namespacesDeclared[attQName.localName]);
            } else if (attQName.qName === "xmlns") {
                namespacesDeclared[""] = this.scanAttValue();
                this.contentHandler.startPrefixMapping("", namespacesDeclared[""]);
            } else {
                var namespaceURI = this.getNamespaceURI(attQName.prefix);
                var value = this.scanAttValue();
                var att = new Sax_Attribute(attQName, namespaceURI, value);
                atts.push(att);
            }
            this.scanAttribute(atts, namespacesDeclared);
        } else {
            this.fireError("invalid attribute, must contain = between name and value", FATAL);
        }
    }
};

// [10] AttValue ::= '"' ([^<&"] | Reference)* '"' | "'" ([^<&'] | Reference)* "'"
SAXParser.prototype.scanAttValue = function() {
    if (this.ch === '"' || this.ch === "'") {
        var quote = this.ch;
        try {
            this.nextChar(true);
            var attValue = this.nextRegExp("[" + quote + "<&]");
            //if found a "&"
            while (this.ch === "&") {
                this.nextChar(true);
                var ref = this.scanRef();
                attValue += ref;
                attValue += this.nextRegExp("[" + quote + "<&]");
            }
            if (this.ch === "<") {
                this.fireError("invalid attribute value, must not contain &lt;", FATAL);
            }
            //current char is ending quote
            this.nextChar();
        //adding a message in that case
        } catch(e) {
            if (e instanceof EndOfInputException) {
                this.fireError("document incomplete, attribute value declaration must end with a quote", FATAL);
            } else {
                throw e;
            }
        }
        return attValue;
    } else {
        this.fireError("invalid attribute value declaration, must begin with a quote", FATAL);
    }
};

// [18]   	CDSect	   ::=   	 CDStart  CData  CDEnd
// [19]   	CDStart	   ::=   	'<![CDATA['
// [20]   	CData	   ::=   	(Char* - (Char* ']]>' Char*))
// [21]   	CDEnd	   ::=   	']]>'
SAXParser.prototype.scanCData = function() {
    if (this.isFollowedBy("[CDATA[")) {
        if (this.lexicalHandler) {
            this.lexicalHandler.startCDATA();
        }
        // Reports the same as for text
        var start = this.index;
        var cdata = this.nextRegExp(/\]\]>/);
        var length = this.index - start;
        this.contentHandler.characters(cdata, start, length);
        //goes after final '>'
        this.index += 3;
        this.ch = this.xml.charAt(this.index);
        if (this.lexicalHandler) {
            this.lexicalHandler.endCDATA();
        }
        return true;
    } else {
        return false;
    }
};

// [66] CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
// current ch is char after "&#",  returned current char is ";"
SAXParser.prototype.scanCharRef = function() {
    var oldIndex = this.index;
    if (this.ch === "x") {
        this.nextChar(true);
        while (this.ch !== ";") {
            if (!/[0-9a-fA-F]/.test(this.ch)) {
                this.fireError("invalid char reference beginning with x, must contain alphanumeric characters only", ERROR);
            }
            this.nextChar(true);
        }
    } else {
        while (this.ch !== ";") {
            if (!/\d/.test(this.ch)) {
                this.fireError("invalid char reference, must contain numeric characters only", ERROR);
            }
            this.nextChar(true);
        }
    }
    return this.xml.substring(oldIndex, this.index);
};

//[68]  EntityRef ::= '&' Name ';'
SAXParser.prototype.scanEntityRef = function() {
    try {
        var ref = this.nextRegExp(/;/);
        if (this.lexicalHandler) {
            this.lexicalHandler.startEntity(ref);
            this.lexicalHandler.endEntity(ref);
        }
        //tries to replace it by its value if declared internally in doctype declaration
        if (this.entities[ref]) {
            ref = this.entities[ref];
        }
        return ref;
    //adding a message in that case
    } catch(e) {
        if (e instanceof EndOfInputException) {
            this.fireError("document incomplete, entity reference must end with ;", FATAL);
        } else {
            throw e;
        }
    }
};

// [42] ETag ::= '</' Name S? '>'
SAXParser.prototype.scanEndingTag = function() {
    var qName = this.getQName();
    var namespaceURI = this.getNamespaceURI(qName.prefix);
    if (qName.qName === this.elementsStack.pop()) {
        this.skipWhiteSpaces();
        if (this.ch === ">") {
            this.endMarkup(namespaceURI, qName);
            this.nextChar(true);
            return true;
        } else {
            this.fireError("invalid ending markup, does not finish with &gt;", FATAL);
        }
    } else {
        this.fireError("invalid ending markup, markup name does not match current one", FATAL);
    }
};


SAXParser.prototype.endMarkup = function(namespaceURI, qName) {
    this.contentHandler.endElement(namespaceURI, qName.localName, qName.qName);
    var namespacesRemoved = this.namespaces.pop();
    for (var i in namespacesRemoved) {
        this.contentHandler.endPrefixMapping(i);
    }
};


/*
if dontSkipWhiteSpace is not passed, then it is false so skipWhiteSpaces is default
if end of document, char is  ''
*/
SAXParser.prototype.nextChar = function(dontSkipWhiteSpace) {
    this.index++;
    this.ch = this.xml.charAt(this.index);
    if (!dontSkipWhiteSpace) {
        this.skipWhiteSpaces();
    }
    if (this.index >= this.length) {
        throw new EndOfInputException();
    }
};

SAXParser.prototype.skipWhiteSpaces = function() {
    while (/[\t\n\r ]/.test(this.ch)) {
        this.index++;
        if (this.index >= this.length) {
            throw new EndOfInputException();
        }
        this.ch = this.xml.charAt(this.index);
    }
};


/*
goes to next reg exp and return content, from current char to the char before reg exp
*/
SAXParser.prototype.nextRegExp = function(regExp) {
    var oldIndex = this.index;
    var inc = this.xml.substr(this.index).search(regExp);
    if (inc === -1) {
        throw new EndOfInputException();
    } else {
        this.index += inc;
        this.ch = this.xml.charAt(this.index);
        return this.xml.substring(oldIndex, this.index);
    }
};

/*

*/
SAXParser.prototype.isFollowedBy = function(str) {
    var length = str.length;
    if (this.xml.substr(this.index, length) === str) {
        this.index += length;
        this.ch = this.xml.charAt(this.index);
        return true;
    }
    return false;
};

/*
[4]   	NameChar	   ::=   	 Letter | Digit | '.' | '-' | '_' | ':' | CombiningChar | Extender
[5]   	Name	   ::=   	(Letter | '_' | ':') (NameChar)*
*/
SAXParser.prototype.nextName = function() {
    return this.nextRegExp(NOT_START_OR_END_CHAR);
};


SAXParser.prototype.nextGT = function() {
    var content = this.nextRegExp(/>/);
    this.index++;
    this.ch = this.xml.charAt(this.index);
    return content;
};

SAXParser.prototype.nextEndPI = function() {
    var content = this.nextRegExp(/\?>/);
    this.index += 2;
    this.ch = this.xml.charAt(this.index);
    return content;
};

/*
goes after ' or " and return content
current char is opening ' or "
*/
SAXParser.prototype.quoteContent = function() {
    this.index++;
    var content = this.nextRegExp(this.ch);
    this.index++;
    this.ch = this.xml.charAt(this.index);
    return content;
};

SAXParser.prototype.fireError = function(message, gravity) {
    var saxParseException = new SAXParseException(message);
    saxParseException.ch = this.ch;
    saxParseException.index = this.index;
    if (gravity === WARNING) {
        this.errorHandler.warning(saxParseException);
    } else if (gravity === ERROR) {
        this.errorHandler.error(saxParseException);
    } else if (gravity === FATAL) {
        throw(saxParseException);
    }
};


/*
static XMLReader 	createXMLReader()
          Attempt to create an XMLReader from system defaults.
static XMLReader 	createXMLReader(java.lang.String className)
          Attempt to create an XML reader from a class name.
*/
function XMLReaderFactory () {
    throw 'XMLReaderFactory is not meant to be instantiated';
}
XMLReaderFactory.createXMLReader = function (className) {
    if (className) {
        return new that[className]();
    }
    return new SAXParser(); // our system default XMLReader (parse() not implemented, however)
};

/*
 XMLReader 	getParent()
          Get the parent reader.
 void 	setParent(XMLReader parent)
          Set the parent reader.
*/
// http://www.saxproject.org/apidoc/org/xml/sax/helpers/XMLFilterImpl.html
// Allows subclasses to override methods to filter input before reaching the parent's methods
function XMLFilterImpl () {}
// INTERFACE: XMLFilter: http://www.saxproject.org/apidoc/org/xml/sax/XMLFilter.html
XMLFilterImpl.prototype.setParent = function (parent) { // e.g., SAXParser
    this.parent = parent;
};
XMLFilterImpl.prototype.getParent = function () {
    return this.parent;
};
// INTERFACE: XMLReader: http://www.saxproject.org/apidoc/org/xml/sax/XMLReader.html
XMLFilterImpl.prototype.getContentHandler = function () {
    return this.parent.getContentHandler();
};
XMLFilterImpl.prototype.getDTDHandler = function () {
    return this.parent.getDTDHandler();
};
XMLFilterImpl.prototype.getEntityResolver = function () {
    return this.parent.getEntityResolver();
};
XMLFilterImpl.prototype.getErrorHandler = function () {
    return this.parent.getErrorHandler();
};
XMLFilterImpl.prototype.getFeature = function (name) { // (java.lang.String)
    return this.parent.getFeature(name);
};
XMLFilterImpl.prototype.getProperty = function (name) { // (java.lang.String)
    return this.parent.getProperty(name);
};
XMLFilterImpl.prototype.parse = function (inputOrSystemId) { // (InputSource input OR java.lang.String systemId)
    return this.parent.parse();
};
XMLFilterImpl.prototype.setContentHandler = function (handler) { // (ContentHandler)
    return this.parent.setContentHandler(handler);
};
XMLFilterImpl.prototype.setDTDHandler = function (handler) { // (DTDHandler)
    return this.parent.setDTDHandler(handler);
};
XMLFilterImpl.prototype.setEntityResolver = function (resolver) { // (EntityResolver)
    return this.parent.setEntityResolver(resolver);
};
XMLFilterImpl.prototype.setErrorHandler = function (handler) { // (ErrorHandler)
    return this.parent.setErrorHandler(handler);
};
XMLFilterImpl.prototype.setFeature = function (name, value) { // (java.lang.String, boolean)
    return this.parent.setFeature(name, value);
};
XMLFilterImpl.prototype.setProperty = function (name, value) { // (java.lang.String, java.lang.Object)
    return this.parent.setProperty(name, value);
};
// END SAX2 XMLReader INTERFACE
// BEGIN CUSTOM API (could make all but parseString() private)

// The following is not really a part of XMLFilterImpl but we are effectively depending on it
XMLFilterImpl.prototype.parseString = function(xml) {
    return this.parent.parseString(xml);
};




// Add public API to global namespace (or other one, if we are in another)
this.SAXParser = SAXParser; // To avoid introducing any of our own to the namespace, this could be commented out, and require use of XMLReaderFactory.createXMLReader(); to get a parser

// Could put on org.xml.sax.
this.SAXException = SAXException;
this.SAXNotSupportedException = SAXNotSupportedException;
this.SAXNotRecognizedException = SAXNotRecognizedException;
this.SAXParseException = SAXParseException;

// Could put on org.xml.sax.helpers.
this.XMLReaderFactory = XMLReaderFactory;
this.XMLFilterImpl = XMLFilterImpl;

// Fix: could also add:
/*
// Could put on org.xml.sax.helpers.
this.NamespaceSupport = NamespaceSupport;
this.AttributesImpl = AttributesImpl;

// Could put on org.xml.sax.ext.
this.Attributes2Impl = Attributes2Impl;
*/

}()); // end namespace
