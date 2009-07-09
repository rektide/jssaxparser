/*global window, XMLHttpRequest, ActiveXObject, AttributesImpl, NamespaceSupport, InputSource, StringReader */
/*
Copyright or © or Copr. Nicolas Debeissat, Brett Zamir

nicolas.debeissat@gmail.com (http://debeissat.nicolas.free.fr/) brettz9@yahoo.com

This software is a computer program whose purpose is to parse XML
files respecting SAX2 specifications.

This software is governed by the CeCILL license under French law and
abiding by the rules of distribution of free software. You can use,
modify and/ or redistribute the software under the terms of the CeCILL
license as circulated by CEA, CNRS and INRIA at the following URL
"http://www.cecill.info".

As a counterpart to the access to the source code and rights to copy,
modify and redistribute granted by the license, users are provided only
with a limited warranty and the software's author, the holder of the
economic rights, and the successive licensors have only limited
liability.

In this respect, the user's attention is drawn to the risks associated
with loading, using, modifying and/or developing or reproducing the
software by the user in light of its specific status of free software,
that may mean that it is complicated to manipulate, and that also
therefore means that it is reserved for developers and experienced
professionals having in-depth computer knowledge. Users are therefore
encouraged to load and test the software's suitability as regards their
requirements in conditions enabling the security of their systems and/or
data to be ensured and, more generally, to use and operate it in the
same conditions as regards security.

The fact that you are presently reading this means that you have had
knowledge of the CeCILL license and that you accept its terms.

*/

// NOTE: We have at least a skeleton for all non-deprecated, non-adapter SAX2 classes/interfaces/exceptions

(function () { // Begin namespace

var that = this; // probably window object

/* Private static variables (constant) */

/* Error values */
var WARNING = "W";
var ERROR = "E";
var FATAL = "F";

/* Scanner states */
var STATE_XML_DECL                  =  0;
var STATE_PROLOG                    =  1;
var STATE_EXT_ENT                   =  2;
var STATE_PROLOG_DOCTYPE_DECLARED   =  3;
var STATE_ROOT_ELEMENT              =  4;
var STATE_CONTENT                   =  5;
var STATE_TRAILING_MISC             =  6;

var XML_VERSIONS = ['1.0', '1.1']; // All existing versions of XML; will check this.features['http://xml.org/sax/features/xml-1.1'] if parser supports XML 1.1
var XML_VERSION = /^1\.\d+$/;
var ENCODING = /^[A-Za-z]([A-Za-z0-9._]|-)*$/;
var STANDALONE = /^yes|no$/;

/* XML Name regular expressions */
var NAME_START_CHAR = ":A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u0200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\ud800-\udb7f\udc00-\udfff"; // The last two ranges are for surrogates that comprise #x10000-#xEFFFF
var NOT_START_CHAR = new RegExp("[^" + NAME_START_CHAR + "]");
var NAME_END_CHAR = ".0-9\u00B7\u0300-\u036F\u203F-\u2040-"; // Don't need escaping since to be put in a character class
var NOT_START_OR_END_CHAR = new RegExp("[^" + NAME_START_CHAR + NAME_END_CHAR + "]");

//[2]   	Char	   ::=   	#x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
//for performance reason I will not be conformant in applying this within the class (see CHAR_DATA_REGEXP)
var CHAR = "\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\ud800-\udb7f\udc00-\udfff";
var NOT_CHAR = '[^'+CHAR+']';
var NOT_A_CHAR = new RegExp(NOT_CHAR);
var NOT_A_CHAR_ERROR_CB = function () {
    return this.fireError("invalid XML character, decimal code number '"+this.ch.charCodeAt(0)+"'", FATAL);
};
var NOT_A_CHAR_CB_OBJ = {pattern:NOT_A_CHAR, cb:NOT_A_CHAR_ERROR_CB};

var WS_STR = '[\\t\\n\\r ]'; // \s is too inclusive
var WS = new RegExp(WS_STR);
//in the case of XML declaration document has not yet been processed, token is on <
var XML_DECL_BEGIN = new RegExp("<\\?xml"+WS_STR);
// in the case of detection of double XML declation, token in after <
var XML_DECL_BEGIN_FALSE = new RegExp("\\?xml("+WS_STR+'|\\?)', 'i');

var NOT_REPLACED_ENTITIES = /^amp$|^lt$|^gt$|^quot$|^apos$/;

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

//check that an implementation of Attributes is provided
if (typeof that.AttributesImpl !== 'function') {
    throw new SAXException("you must import an implementation of Attributes, like AttributesImpl.js, in the html");
}


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
SAXParseException.prototype.getColumnNumber = function () {};
SAXParseException.prototype.getLineNumber = function () {};
SAXParseException.prototype.getPublicId = function () {};
SAXParseException.prototype.getSystemId = function () {};


// CUSTOM EXCEPTION CLASSES
// Our own exception class; should this perhaps extend SAXParseException?
function EndOfInputException() {}

function InternalEntityNotFoundException (entityName) {
    this.entityName = entityName;
}
InternalEntityNotFoundException.prototype = new SAXParseException();
InternalEntityNotFoundException.constructor = InternalEntityNotFoundException;

// CUSTOM HELPER CLASSES
/*
in case of attributes, empty prefix will be null because default namespace is null for attributes
in case of elements, empty prefix will be "".
*/
function Sax_QName(prefix, localName) {
    this.prefix = prefix;
    this.localName = localName;
    if (prefix) {
        this.qName = prefix + ":" + localName;
    } else {
        this.qName = localName;
    }
}
Sax_QName.prototype.equals = function(qName) {
    return this.qName === qName.qName;
};

/*
Class for storing publicId and systemId
*/
function ExternalId() {
    this.publicId = null;
    this.systemId = null;
}
ExternalId.prototype.toString = function() {
    return "ExternalId";
};


// NOTE: The following notes might not be perfectly up to date
// The official SAX2 parse() method is not fully implemented (to accept an InputSource object constructed by a
//    Reader (like StringReader would probably be best) or InputStream). For now the parseString() method can
//    be used (and is more convenient than converting to an InputSource object).
// The feature/property defaults are incomplete, as they really depend on the implementation and how far we
//   implement them; however, we've added defaults, two of which (on namespaces) are required to be
//   supported (though they don't need to support both true and false options).
// FURTHER NOTES:
// 1) No property should be retrieved or set publicly.
// 2) The SAXParser constructor currently only works with these arguments: first (partially), second, third, and fourth (partially)

// Currently does not call the following (as does the DefaultHandler2 class)
// 1) on the contentHandler: ignorableWhitespace(), skippedEntity(), setDocumentLocator() (including with Locator2)
// 2) on the DeclHandler: attributeDecl(), elementDecl(), externalEntityDecl()
// 3) on EntityResolver: resolveEntity()
// 4) on EntityResolver2: resolveEntity() (additional args) or getExternalSubset()
// 5) on DTDHandler: notationDecl(), unparsedEntityDecl()
// lexicalHandler and errorHandler interface methods, however, are all supported
// Need to also implement Attributes2 in startElement (rename AttributesImpl to Attributes2Impl and add interface)

function SAXParser (contentHandler, lexicalHandler, errorHandler, declarationHandler, dtdHandler, domNode, locator) {
    // Implements SAX2 XMLReader interface (except for parse() methods)
    // XMLReader doesn't specify a constructor (though XMLFilterImpl does), so this class is able to define its own behavior to accept a contentHandler, etc.

    this.contentHandler = contentHandler;
    this.locator = locator;
    if (this.locator) { // Set defaults (if accessed before set)
        // For Locator (there are no standard fields for us to use; our Locator must support these)
        this.locator.columnNumber = -1;
        this.locator.lineNumber = -1;
        this.locator.publicId = null;
        this.locator.systemId = null;
        // For Locator2 (there are no standard fields for us to use; our Locator2 must support these)
        this.locator.version = null;
        this.locator.encoding = null;
        this.contentHandler.setDocumentLocator(locator);
    }
    this.dtdHandler = dtdHandler;
    this.errorHandler = errorHandler;
    this.entityResolver = null;

    try {
        this.namespaceSupport = new NamespaceSupport();
    } catch(e2) {
        throw new SAXException("you must import an implementation of NamespaceSupport, like NamespaceSupport.js, in the html", e2);
    }

    this.disallowedGetProperty = [];
    this.disallowedGetFeature = [];
    this.disallowedSetProperty = [];
    this.disallowedSetFeature = [];

    this.disallowedSetPropertyValues = {};
    this.disallowedSetFeatureValues = {};

    // For official features and properties, see http://www.saxproject.org/apidoc/org/xml/sax/package-summary.html#package_description
    // We can define our own as well
    // Except where specified, all features and properties should be supported (in at least the default configuration)
    this.features = {}; // Boolean values
    this.features['http://xml.org/sax/features/external-general-entities'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/external-parameter-entities'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/is-standalone'] = undefined; // Can only be set during parsing
    this.features['http://xml.org/sax/features/lexical-handler/parameter-entities'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/namespaces'] = true; // must support true
    this.features['http://xml.org/sax/features/namespace-prefixes'] = false; // must support false; are we now operating as true? (i.e., XML qualified names (with prefixes) and attributes (including xmlns* attributes) are available?)
    this.features['http://xml.org/sax/features/resolve-dtd-uris'] = true;
    this.features['http://xml.org/sax/features/string-interning'] = true; // Make safe to treat string literals as identical to String()
    this.features['http://xml.org/sax/features/unicode-normalization-checking'] = false;
    this.features['http://xml.org/sax/features/use-attributes2'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/use-locator2'] = !!(locator && // No interfaces in JavaScript, so we duck-type:
                                                                                                                    typeof locator.getXMLVersion === 'function' &&
                                                                                                                    typeof locator.getEncoding === 'function'
                                                                                                                ); // Not supported yet
    this.features['http://xml.org/sax/features/use-entity-resolver2'] = true;
    this.features['http://xml.org/sax/features/validation'] = false; // Not supported yet
    this.features['http://xml.org/sax/features/xmlns-uris'] = false;
    this.features['http://xml.org/sax/features/xml-1.1'] = false; // Not supported yet

    // Our custom features (as for other features, retrieve/set publicly via getFeature/setFeature):
    // We are deliberately non-conformant by default (for performance reasons)
    this.features['http://debeissat.nicolas.free.fr/ns/character-data-strict'] = false;
    if (this.features['http://debeissat.nicolas.free.fr/ns/character-data-strict']) {
        this.CHAR_DATA_REGEXP = new RegExp(NOT_CHAR+'|[<&\\]]');
    }
    else {
        this.CHAR_DATA_REGEXP = /[<&\]]/;
    }

    this.properties = {}; // objects
    this.properties['http://xml.org/sax/properties/declaration-handler'] = this.declarationHandler = declarationHandler;
    this.properties['http://xml.org/sax/properties/document-xml-version'] = null;
    this.properties['http://xml.org/sax/properties/dom-node'] = this.domNode = domNode; // Not supported yet (if treating DOM node as though SAX2, this will be starting node)
    this.properties['http://xml.org/sax/properties/lexical-handler'] = this.lexicalHandler = lexicalHandler || null;
    this.properties['http://xml.org/sax/properties/xml-string'] = null; // Not supported yet (update with characters that were responsible for the event)
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

// For convenience, when dealing with strings as input, one can simply use our own parseString() instead of
// XMLReader's parse() which expects an InputSouce (or systemId)
// Note: The InputSource argument is not fully supported, as the parser currently does not use its methods for parsing
SAXParser.prototype.parse = function (inputOrSystemId) { // (InputSource input OR java.lang.String systemId)
    // Parse an XML document (void). OR
    // Parse an XML document from a system identifier (URI) (void).
    // may throw java.io.IOException or SAXException
    var systemId, xmlAsString, path;
    if (inputOrSystemId instanceof InputSource) {
        var charStream = inputOrSystemId.getCharacterStream();
        var byteStream = inputOrSystemId.getByteStream();
        // Priority for the parser is characterStream, byteStream, then URI, but we only really implemented the systemId (URI), so we automatically go with that
        systemId = inputOrSystemId.getSystemId();
        if (charStream) {
            if (charStream instanceof StringReader) { // Fix: This if-else is just a hack, until the parser may support Reader's methods like read()
                xmlAsString = charStream.s;
            }
            else {
                throw "A character stream InputSource is not implemented at present unless it is a StringReader character stream (and that only if it is our own version which has the string on the 's' property)";
            }
        }
        else if (byteStream || systemId) {
            this.encoding = inputOrSystemId.getEncoding(); // To be used during XML Declaration checking
            if (byteStream) {
                throw "A byte stream InputSource is not implemented at present in SAXParser's parse() method";
            }
        }
        if (!systemId && !xmlAsString) {
            throw "The SAXParser parse() method must, at present, take an InputSource with a systemId or with a StringReader character stream";
        }
    } else if (typeof inputOrSystemId === "string") {
        systemId = inputOrSystemId;
    } else {
        throw "The argument supplied to SAXParser's parse() method was invalid";
    }
    this.systemId = systemId;
    if (!xmlAsString) { // If not set above
        // Fix: According to the specification for parse() (and InputSource's systemId constructor), the URL should be fully resolved (not relative)
        xmlAsString = this.loadFile(systemId);
        //get the path to the file
        path = systemId.substring(0, systemId.lastIndexOf("/") + 1);
        this.baseURI = path;
    }
    this.parseString(xmlAsString);
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
    this.namespaceSupport.reset();

    /* map between entity names and values */
    this.entities = {};
    /* map between parameter entity names and values
            the parameter entites are used inside the DTD */
    this.parameterEntities = {};
    /* map between external entity names and URIs  */
    this.externalEntities = {};
    /* As an attribute is declared for an element, that should
                contain a map between element name and a map between
                attributes name and types ( 3 level tree) */
    this.attributesType = {};
    /* this.baseURI is the relative URI of the XML file loaded. not possible to load a file above the html */
    if (!this.baseURI) {
        this.baseURI = window.location;
    }
    /* on each depth, a relative base URI, empty if no xml:base found, is recorded */
    this.relativeBaseUris = [];
    this.contentHandler.startDocument();
    //if all whitespaces, w3c test case xmlconf/xmltest/not-wf/sa/050.xml
    if (!(/[^\t\n\r ]/.test(this.xml))) {
        this.fireError("empty document", FATAL);
    }
    try {
        // We must test for the XML Declaration before processing any whitespace
        this.startParsing();
        this.state = STATE_PROLOG;
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
                    //maybe validation exceptions
                    this.contentHandler.endDocument();
                } catch(e2) {
                    throw e2;
                }
            }
        } else {
            throw e;
        }
    }
};

/*
scan XML declaration, test first character of document, and if right goes to character after <
*/
SAXParser.prototype.startParsing = function() {
    //if no XML declaration, then white spaces are allowed at beginning of XML
    if (!this.scanXMLDeclOrTextDecl()) {
        this.skipWhiteSpaces();
    }
    if (this.ch !== "<") {
        this.fireError("Invalid first character in document, external entity or external subset : [" + this.ch + "]", FATAL);
    }
};

// BEGIN FUNCTIONS WHICH SHOULD BE CONSIDERED PRIVATE
SAXParser.prototype.next = function() {
    this.skipWhiteSpaces();
    if (this.ch === "<") {
        this.nextChar(true);
        this.scanMarkup();
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
SAXParser.prototype.scanMarkup = function() {
    if (this.state === STATE_PROLOG) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                //there is no other choice but, in case exception is not FATAL,
                // and in order to have equivalent behaviours between scan()
                if (this.scanDoctypeDecl()) {
                    this.state = STATE_PROLOG_DOCTYPE_DECLARED;
                }
            }
        } else if (this.ch === "?") {
            //in case it is not a valid processing instruction
            //scanPI will throw the exception itself, with a better message
            this.scanPI();
        } else {
            this.state = STATE_ROOT_ELEMENT;
            //does not go to next char exiting the method
            this.scanMarkup();
        }
    } else if (this.state === STATE_PROLOG_DOCTYPE_DECLARED) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                if (this.isFollowedBy("DOCTYPE")) {
                    this.fireError("can not have two doctype declarations", FATAL);
                } else {
                    this.fireError("invalid declaration, only a comment is allowed here after &lt;!", FATAL);
                }
            }
        } else if (this.ch === "?") {
            //in case it is not a valid processing instruction
            //scanPI will throw the exception itself, with a better message
            this.scanPI();
        } else {
            this.state = STATE_ROOT_ELEMENT;
            //does not go to next char exiting the method
            this.scanMarkup();
        }
    } else if (this.state === STATE_ROOT_ELEMENT) {
        if (this.scanElement()) {
            //there may be just a root empty markup (already closed)
            if (this.elementsStack.length > 0) {
                this.state = STATE_CONTENT;
            } else {
                this.state = STATE_TRAILING_MISC;
            }
        } else {
            this.fireError("document is empty, no root element detected", FATAL);
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
            //in case it is not a valid processing instruction
            //scanPI will throw the exception itself, with a better message
            this.scanPI();
        } else if (this.ch === "/") {
            this.nextChar(true);
            if (this.scanEndingTag()) {
                if (this.elementsStack.length === 0) {
                    this.state = STATE_TRAILING_MISC;
                }
            }
        } else {
            if (!this.scanElement()) {
                this.fireError("not valid markup", FATAL);
            }
        }
    } else if (this.state === STATE_TRAILING_MISC) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                this.fireError("end of document, only comments or processing instructions are allowed", FATAL);
            }
        } else if (this.ch === "?") {
            if (!this.scanPI()) {
                this.fireError("end of document, only comment or processing instruction are allowed", FATAL);
            }
        } else if (this.ch === "/") {
            this.fireError("invalid ending tag at root of the document", FATAL);
        } else {
            this.fireError("only one document element is allowed", FATAL);
        }
    }
};

//  what I understand from there : http://www.w3.org/TR/REC-xml/#dt-chardata is that & is allowed
// in character data only if it is an entity reference
SAXParser.prototype.scanText = function() {
    var start = this.index;
    var content = this.scanCharData();
    //in case of external entity, the process is reinitialized??
    var entityStart;
    try {
        //if found a "&"
        while (this.ch === "&") {
            entityStart = this.index;
            this.nextChar(true);
            var ref = this.scanRef();
            content += ref;
            content += this.scanCharData();
        }
    } catch (e) {
        if (e instanceof InternalEntityNotFoundException) {
            // at this place in XML, that entity ref may be an external entity
            var externalId = this.externalEntities[e.entityName];
            if (externalId === undefined) {
                this.fireError("entity : [" + e.entityName + "] not declared as an internal entity or as an external one", ERROR);
            } else {
                this.includeEntity(e.entityName, entityStart, externalId);
            }
        } else {
            throw e;
        }
    }
    //in all cases report the text found, a text found before external entity if present
    var length = this.index - start;
    this.contentHandler.characters(content, start, length);
};

// 14]   	CharData ::= [^<&]* - ([^<&]* ']]>' [^<&]*)
SAXParser.prototype.scanCharData = function() {
    var content = this.nextCharRegExp(this.CHAR_DATA_REGEXP, NOT_A_CHAR_CB_OBJ);
    //if found a "]", must ensure that it is not followed by "]>"
    while (this.ch === "]") {
        this.nextChar(true);
        if (this.isFollowedBy("]>")) {
            this.fireError("Text may not contain a literal ']]&gt;' sequence", ERROR);
        }
        content += "]" + this.nextCharRegExp(this.CHAR_DATA_REGEXP, NOT_A_CHAR_CB_OBJ);
    }
    return content;
};

SAXParser.prototype.resolveEntity = function(entityName, publicId, baseURI, systemId) {
    var txt = this.loadFile(this.baseURI + systemId);
    if (txt) {
        return txt;
    }
    return "";
};

SAXParser.prototype.loadFile = function(fname) {
	var xmlhttp = null;
	if (window.XMLHttpRequest) {// code for Firefox, Opera, IE7, etc.
		xmlhttp = new XMLHttpRequest();
	} else if (window.ActiveXObject) {// code for IE6, IE5
		xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
	}
	if (xmlhttp !== null) {
		xmlhttp.open("GET", fname, false);
		xmlhttp.send(null);
		if (xmlhttp.readyState === 4) {
			return xmlhttp.responseText;
		}
	} else {
		this.fireError("Your browser does not support XMLHTTP, the external entity with URL : [" + fname + "] will not be resolved", ERROR);
	}
    return false;
};

SAXParser.prototype.getRelativeBaseUri = function() {
    var returned = "";
    var i = this.relativeBaseUris.length;
    while (i--) {
        returned += this.relativeBaseUris[i];
    }
    return returned;
};

/*
 entity is replaced and its replacement is parsed, see http://www.w3.org/TR/REC-xml/#included
 entityName is used for SAX compliance with resolveEntity and recursion detection
 */
SAXParser.prototype.includeEntity = function(entityName, entityStartIndex, replacement) {
    //if it is an externalId, have to include the external content
    if (replacement instanceof ExternalId) {
        var relativeBaseUri = this.getRelativeBaseUri();
        try {
            var externalEntity = this.resolveEntity(entityName, replacement.publicId, relativeBaseUri, replacement.systemId);
            //if not only whitespace
            if (/[^\t\n\r ]/.test(externalEntity)) {
                //check for no recursion
                if (new RegExp("&" + entityName + ";").test(externalEntity)) {
                    this.fireError("Recursion detected : [" + entityName + "] contains a reference to itself", FATAL);
                }
                //there may be another xml declaration at beginning of external entity
                this.includeText(entityStartIndex, externalEntity);
                var oldState = this.state;
                this.state = STATE_EXT_ENT;
                this.startParsing();
                this.state = oldState;
            }
        } catch(e) {
            this.fireError("issue at resolving entity : [" + entityName + "], publicId : [" + replacement.publicId + "], uri : [" + relativeBaseUri + "], systemId : [" + replacement.systemId + "], got exception : [" + e.toString() + "]", ERROR);
        }
    } else {
        this.includeText(entityStartIndex, replacement);
    }
};

SAXParser.prototype.includeText = function(entityStartIndex, replacement) {
    // entity is replaced and its replacement is parsed, see http://www.w3.org/TR/REC-xml/#included
    this.xml = this.xml.substring(0, entityStartIndex).concat(replacement, this.xml.substr(this.index));
    this.length = this.xml.length;
    this.index = entityStartIndex;
    this.ch = this.xml.charAt(this.index);
};

/*
current char is after '&'
may return undefined if entity has not been found (if external for example)
*/
SAXParser.prototype.scanRef = function() {
    var ref;
    if (this.ch === "#") {
        this.nextChar(true);
        ref = this.scanCharRef();
    } else {
        ref = this.scanEntityRef();
    }
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
                return this.fireError("end of comment not valid, must be --&gt;", FATAL);
            }
        } else {
            return this.fireError("beginning comment markup is invalid, must be &lt;!--", FATAL);
        }
    } else {
        // can be a doctype
        return false;
    }
};


SAXParser.prototype.setEncoding = function (encoding) {
    if (this.locator) {
        this.locator.setEncoding(this.encoding || encoding); // Higher priority is given to any encoding set on an InputSource (passed in during parse())
    }
};

SAXParser.prototype.setXMLVersion = function (version) {
   if (version) {
        if (XML_VERSIONS.indexOf(version) === -1) {
            this.fireError("The specified XML Version is not a presently valid XML version number", FATAL); // e.g. 1.5
        }
        else if (version === '1.1' && this.features['http://xml.org/sax/features/xml-1.1'] === false) {
            this.fireError("The XML text specifies version 1.1, but this parser does not support this version.", FATAL);
        }
        this.properties['http://xml.org/sax/properties/document-xml-version'] = version;
        if (this.locator) {
            this.locator.setXMLVersion(version);
        }
    }
};

SAXParser.prototype.scanXMLDeclOrTextDeclAttribute = function (allowableAtts, allowableValues, requireWS) {
    if (this.ch === "?") {
        return false;
    }
    if (requireWS && !WS.test(this.ch)) {
        return this.fireError('The XML Declaration or Text Declaration must possess a space between the version/encoding/standalone information.', FATAL);
    }
    this.skipWhiteSpaces();
    var attName = this.scanName();
    var attPos = allowableAtts.indexOf(attName);
    if (attPos === -1) {
        if (['version', 'encoding', 'standalone'].indexOf(attName) !== -1) {
            return this.fireError('The attribute name "'+attName+'" was not expected at this position in an XML or text declaration. It was expected to be: '+allowableAtts.join(', '), FATAL);
        }
        return this.fireError('The attribute name "'+attName+'" does not match the allowable names in an XML or text declaration: '+allowableAtts.join(', '), FATAL);
    }
    this.skipWhiteSpaces();
    if (this.ch === "=") {
        this.nextChar();
        if (this.ch === '"' || this.ch === "'") {
            var quote = this.ch;
            try {
                this.nextChar(true);
                var attValue = this.nextRegExp("[" + quote + "]");
                if (!allowableValues[attPos].test(attValue)) {
                    return this.fireError('The attribute value "'+attValue+'" does not match the allowable values in an XML or text declaration: '+allowableValues[attPos], FATAL);
                }
                //current char is ending quote
                this.nextChar(true);
            //adding a message in that case
            } catch(e) {
                if (e instanceof EndOfInputException) {
                    return this.fireError("document incomplete, attribute value declaration must end with a quote", FATAL);
                } else {
                    throw e;
                }
            }
        } else {
            return this.fireError("invalid declaration attribute value declaration, must begin with a quote", FATAL);
        }
    } else {
        return this.fireError("invalid declaration attribute, must contain = between name and value", FATAL);
    }
    return [attName, attValue];
};

/*
 [23] XMLDecl ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'
 [24] VersionInfo ::= S 'version' Eq (' VersionNum ' | " VersionNum ")
 [80] EncodingDecl ::= S 'encoding' Eq ('"' EncName '"' |  "'" EncName "'" )
 [81] EncName ::= [A-Za-z] ([A-Za-z0-9._] | '-')*
 [32] SDDecl ::= S 'standalone' Eq (("'" ('yes' | 'no') "'")
                 | ('"' ('yes' | 'no') '"'))
 [77] TextDecl ::= '<?xml' VersionInfo? EncodingDecl S? '?>'
 current character is "<", at return current char is after ending ">"
 */
SAXParser.prototype.scanXMLDeclOrTextDecl = function() {
    // Fix: need to have conditions to trigger STATE_EXT_ENT somehow
    // allow scanning of text declaration/external XML entity?
    var version = null;
    var encoding = 'UTF-8'; // As the default with no declaration is UTF-8, we assume it is such, unless the
    // encoding is indicated explicitly, in which case we will trust that. We are therefore not able to discern
    // UTF-16 represented without an explicit declaration nor report any inconsistencies between header encoding,
    // byte-order mark, or explicit encoding information, unless it is reported on InputSource (see next note).

    // If we were processing individual bytes (e.g., if we represented XML as an array of bytes), we
    //    could detect the encoding ourselves, including byte-order mark (and also allow checking
    //    against any header encoding), but since JavaScript converts pages for us into UTF-16 (two bytes per
    //    character), we cannot use the same approach unless we allow the InputSource with the InputStream (byteStream)
    //    constructor in Java SAX2; instead we take an approach more similar to the StringReader (Reader characterStream
    //    constructor), though we haven't fully implemented that API at present: http://java.sun.com/j2se/1.4.2/docs/api/java/io/StringReader.html
    // This script will therefore not detect an inconsistency between the encoding of the original document (since
    //    we don't know what it is) and the encoding indicated in its (optional) XML Declaration/Text Declaration

    if ((XML_DECL_BEGIN).test(this.xml.substr(this.index, 6))) {
        this.nextNChar(6);
        var standalone = false;
        if (this.state === STATE_XML_DECL) {
            var versionArr = this.scanXMLDeclOrTextDeclAttribute(['version'], [XML_VERSION]);
            if (!versionArr) {
                return this.fireError("An XML Declaration must have version information", FATAL);
            }
            version = versionArr[1];
            this.setXMLVersion(version);
            var encodingOrStandalone = this.scanXMLDeclOrTextDeclAttribute(['encoding', 'standalone'], [ENCODING, STANDALONE], true);
            if (encodingOrStandalone) {
                if (encodingOrStandalone[0] === 'encoding') {
                    encoding = encodingOrStandalone[1];
                    this.setEncoding(encoding);
                    
                    var standaloneArr = this.scanXMLDeclOrTextDeclAttribute(['standalone'], [STANDALONE], true);
                    if (standaloneArr && standaloneArr === 'yes') {
                        standalone = true;
                    }
                }
            }
            this.features['http://xml.org/sax/features/is-standalone'] = standalone;
        }
        else { // STATE_EXT_ENT
            var versionOrEncodingArr = this.scanXMLDeclOrTextDeclAttribute(['version', 'encoding'], [XML_VERSION, ENCODING]);
            if (versionOrEncodingArr[0] === 'version') {
                version = versionOrEncodingArr[1];
                this.setXMLVersion(version);
                versionOrEncodingArr = this.scanXMLDeclOrTextDeclAttribute(['encoding'], [ENCODING], true);
            }
            if (!versionOrEncodingArr) {
                return this.fireError("A text declaration must possess explicit encoding information", FATAL);
            }
            encoding = versionOrEncodingArr[1];
            this.setEncoding(encoding);
        }

        this.skipWhiteSpaces();
        if (this.ch !== "?") {
            return this.fireError("invalid markup, '"+this.ch+"', in XML or text declaration where '?' expected", FATAL);
        }
        this.nextChar(true);
        if (this.ch !== ">") {
            return this.fireError("invalid markup inside XML or text declaration; must end with &gt;", FATAL);
        } else {
            this.nextChar();
        }
        return true;
    } else {
        if (this.state === STATE_XML_DECL) {
            this.setXMLVersion('1.0'); // Assumed when no declaration present
            if (this.locator) {
                this.locator.setEncoding(encoding);
            }
            this.features['http://xml.org/sax/features/is-standalone'] = false;
        }
        return false;
    }
};


// [16] PI ::= '<?' PITarget (S (Char* - (Char* '?>' Char*)))? '?>'
// [17] PITarget ::= Name - (('X' | 'x') ('M' | 'm') ('L' | 'l'))
SAXParser.prototype.scanPI = function() {
    if ((XML_DECL_BEGIN_FALSE).test(this.xml.substr(this.index, 5))) {
        return this.fireError("XML Declaration cannot occur past the very beginning of the document.", FATAL);
    }
    this.nextChar(true);
    this.contentHandler.processingInstruction(this.scanName(), this.nextEndPI());
    return true;
};


//[28]   	doctypedecl	   ::=   	'<!DOCTYPE' S  Name (S  ExternalID)? S? ('[' intSubset ']' S?)? '>'
SAXParser.prototype.scanDoctypeDecl = function() {
    if (this.isFollowedBy("DOCTYPE")) {
        this.nextChar();
        var name = this.nextCharRegExp(/[ \[>]/);
        this.skipWhiteSpaces();
        var externalId = new ExternalId();
        //if there is an externalId
        this.scanExternalId(externalId);
        if (this.lexicalHandler) {
            this.lexicalHandler.startDTD(name, externalId.publicId, externalId.systemId);
        }
        if (this.ch === "[") {
            this.nextChar();
            while (this.ch !== "]") {
                this.scanDoctypeDeclIntSubset();
            }
            this.nextChar();
        }
        //extract of specs : if both the external and internal subsets are used, the internal subset MUST be considered to occur before the external subset
        if (externalId.systemId !== null) {
            //in case of restricted uri error
            try {
                var extSubset = this.loadFile(this.baseURI + externalId.systemId);
                this.scanExtSubset(extSubset);
            } catch(e) {
                this.fireError("exception : [" + e.toString() + "] trying to load external subset : [" + this.baseURI + externalId.systemId + "]", WARNING);
            }
        }
        if (this.ch !== ">") {
            return this.fireError("invalid content in doctype declaration", FATAL);
        } else {
            this.nextChar();
        }
        if (this.lexicalHandler) {
            this.lexicalHandler.endDTD();
        }
        return true;
    } else {
        return this.fireError("invalid doctype declaration, must be &lt;!DOCTYPE", FATAL);
    }
};

/*
[30]   	extSubset	   ::=   	 TextDecl? extSubsetDecl
[31]   	extSubsetDecl	   ::=   	( markupdecl | conditionalSect | DeclSep)*
*/
SAXParser.prototype.scanExtSubset = function(extSubset) {
    if (/[^\t\n\r ]/.test(extSubset)) {
        //restart the index
        var currentIndex = this.index;
        var currentXml = this.xml;
        this.xml = extSubset;
        this.length = this.xml.length;
        this.index = 0;
        this.ch = this.xml.charAt(this.index);
        this.startParsing();
        //current char is first <
        try {
            //should also support conditionalSect
            this.scanDoctypeDeclIntSubset();
        } catch(e) {
            if (!(e instanceof EndOfInputException)) {
                throw e;
            }
        }
        this.xml = currentXml;
        this.length = this.xml.length;
        this.index = currentIndex;
        this.ch = this.xml.charAt(this.index);
    }
};

//[75]   	ExternalID	   ::=   	'SYSTEM' S  SystemLiteral
//			| 'PUBLIC' S PubidLiteral S SystemLiteral
SAXParser.prototype.scanExternalId = function(externalId) {
    if (this.isFollowedBy("SYSTEM")) {
        this.nextChar();
        externalId.systemId = this.scanSystemLiteral();
        this.skipWhiteSpaces();
        return true;
    } else if (this.isFollowedBy("PUBLIC")) {
        this.nextChar();
        externalId.publicId = this.scanPubIdLiteral();
        this.nextChar();
        externalId.systemId = this.scanSystemLiteral();
        this.skipWhiteSpaces();
        return true;
    }
    return false;
};

//current char should be the quote
//[11]   	SystemLiteral	   ::=   	('"' [^"]* '"') | ("'" [^']* "'")
SAXParser.prototype.scanSystemLiteral = function(externalId) {
    if (this.ch !== "'" && this.ch !== '"') {
        return this.fireError("invalid sytem Id declaration, should begin with a quote", FATAL);
    }
    return this.quoteContent();
};

//current char should be the quote
//[12]   	PubidLiteral	   ::=   	'"' PubidChar* '"' | "'" (PubidChar - "'")* "'"
//[13]   	PubidChar	   ::=   	#x20 | #xD | #xA | [a-zA-Z0-9] | [-'()+,./:=?;!*#@$_%]
SAXParser.prototype.scanPubIdLiteral = function(externalId) {
    if (this.ch !== "'" && this.ch !== '"') {
        return this.fireError("invalid Public Id declaration, should begin with a quote", FATAL);
    }
    return this.quoteContent();
};

/*
Parameter entity references are recognized anywhere in the DTD (internal and external subsets and external parameter entities),
except in literals, processing instructions, comments, and the contents of ignored conditional sections
current char is %
*/
SAXParser.prototype.includeParameterEntity = function() {
    var entityStart = this.index;
    this.nextChar(true);
    var entityName = this.nextCharRegExp(/;/);
    // if % found here, include and parse replacement
    var replacement = this.scanPeRef(entityName);
    //current char is ending quote
    this.nextChar(true);
    // entity is replaced and its replacement is parsed, see http://www.w3.org/TR/REC-xml/#included
    this.includeEntity(entityName, entityStart, replacement);
    //white spaces are not significant here
    this.skipWhiteSpaces();
}

/*
actual char is non whitespace char after '['
[28a]   	DeclSep	   ::=   	 PEReference | S
[28b]   	intSubset	   ::=   	(markupdecl | DeclSep)*
[29]   	markupdecl	   ::=   	 elementdecl | AttlistDecl | EntityDecl | NotationDecl | PI | Comment
*/
SAXParser.prototype.scanDoctypeDeclIntSubset = function() {
    if (this.ch === "<") {
        this.nextChar(true);
        if (this.ch === "?") {
            if (!this.scanPI()) {
                this.fireError("invalid processing instruction inside doctype declaration", FATAL);
            }
        } else if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                if (!this.scanEntityDecl() && !this.scanElementDecl() &&
                        !this.scanAttlistDecl() && !this.scanNotationDecl()) {
                    //no present support for other declarations
                    this.nextCharRegExp(/>/);
                }
                this.skipWhiteSpaces();
                if (this.ch !== ">") {
                    this.fireError("invalid markup declaration inside doctype declaration, must end with &gt;", FATAL);
                }
                this.nextChar();
            } else {
                //if comment, must go over the whitespaces as they are not significative in doctype internal subset declaration
                this.skipWhiteSpaces();
            }
        }
    /*
    Reference in DTD	 Included as PE
*/
    } else if (this.ch === "%") {
        this.includeParameterEntity();
    } else {
        this.fireError("invalid character in internal subset of doctype declaration : [" + this.ch + "]", FATAL);
    }
};

/*
[70]   	EntityDecl	   ::=   	 GEDecl  | PEDecl
[71]   	          GEDecl	   ::=   	'<!ENTITY' S  Name  S  EntityDef  S? '>'
[72]   	PEDecl	   ::=   	'<!ENTITY' S '%' S Name S PEDef S? '>'
[73]   	EntityDef	   ::=   	 EntityValue  | (ExternalID  NDataDecl?)
[74]   	PEDef	   ::=   	EntityValue | ExternalID
[75]   	ExternalID	   ::=   	'SYSTEM' S  SystemLiteral
			| 'PUBLIC' S PubidLiteral S SystemLiteral
[76]   	NDataDecl	   ::=   	S 'NDATA' S Name
*/
SAXParser.prototype.scanEntityDecl = function() {
    var entityName, externalId, entityValue;
    if (this.isFollowedBy("ENTITY")) {
        this.nextChar();
        if (this.ch === "%") {
            this.nextChar();
            entityName = this.scanName();
            this.nextChar();
            //if already declared, not effective
            if (!this.entities[entityName]) {
                externalId = new ExternalId();
                if (!this.scanExternalId(externalId)) {
                    entityValue = this.scanEntityValue();
                    this.parameterEntities[entityName] = entityValue;
                    if (this.declarationHandler) {
                        this.declarationHandler.internalEntityDecl("%" + entityName, entityValue);
                    }
                } else {
                    this.parameterEntities[entityName] = externalId;
                }
            }
        } else {
            entityName = this.scanName();
            this.nextChar();
            //if already declared, not effective
            if (!this.entities[entityName]) {
                externalId = new ExternalId();
                if (this.scanExternalId(externalId)) {
                    if (this.isFollowedBy("NDATA")) {
                        this.nextChar();
                        var ndataName = this.scanName();
                    }
                    this.externalEntities[entityName] = externalId;
                } else {
                    entityValue = this.scanEntityValue();
                    this.entities[entityName] = entityValue;
                    if (this.declarationHandler) {
                        this.declarationHandler.internalEntityDecl(entityName, entityValue);
                    }
                }
            }
        }
        return true;
    }
    return false;
};

/*
[9]   	EntityValue	   ::=   	'"' ([^%&"] | PEReference | Reference)* '"'
			|  "'" ([^%&'] | PEReference | Reference)* "'"
[68]   	EntityRef	   ::=   	'&' Name ';'
[69]   	PEReference	   ::=   	'%' Name ';'
*/
SAXParser.prototype.scanEntityValue = function() {
    if (this.ch === '"' || this.ch === "'") {
        var quote = this.ch;
        this.nextChar(true);
        var entityValue = this.nextCharRegExp(new RegExp("[" + quote + "%]"));
        //if found a "%" must replace it, EntityRef are not replaced here.
        while (this.ch === "%") {
            this.nextChar(true);
            var ref = this.scanPeRef();
            entityValue += ref;
            entityValue += this.nextCharRegExp(new RegExp("[" + quote + "%]"));
        }
        //current char is ending quote
        this.nextChar();
        return entityValue;
    } else {
        return this.fireError("invalid entity value declaration, must begin with a quote", ERROR);
    }
};

/*
[69]   	PEReference	   ::=   	'%' Name ';'
for use in scanDoctypeDeclIntSubset where we need the original entityName, it may have already been parsed
*/
SAXParser.prototype.scanPeRef = function(entityName) {
    try {
        if (entityName === undefined) {
            entityName = this.nextCharRegExp(/;/);
        }
        //tries to replace it by its value if declared internally in doctype declaration
        var replacement = this.parameterEntities[entityName];
        if (replacement) {
            return replacement;
        }
        this.fireError("parameter entity reference : [" + entityName + "] has not been declared, no replacement found", ERROR);
        return "";
    //adding a message in that case
    } catch(e) {
        if (e instanceof EndOfInputException) {
            return this.fireError("document incomplete, parameter entity reference must end with ;", FATAL);
        } else {
            throw e;
        }
    }
};

/*
[45]   	elementdecl	   ::=   	'<!ELEMENT' S  Name  S  contentspec  S? '>'
[46]   	contentspec	   ::=   	'EMPTY' | 'ANY' | Mixed | children
[51]    	Mixed	   ::=   	'(' S? '#PCDATA' (S? '|' S? Name)* S? ')*'
			| '(' S? '#PCDATA' S? ')'
[47]   	children	   ::=   	(choice | seq) ('?' | '*' | '+')?
*/
SAXParser.prototype.scanElementDecl = function() {
    if (this.isFollowedBy("ELEMENT")) {
        this.nextChar();
        var name = this.scanName();
        this.nextChar();
        /*
        The content model will consist of the string "EMPTY", the string "ANY", or a parenthesised group, optionally followed by an occurrence indicator. The model will be normalized so that all parameter entities are fully resolved and all whitespace is removed,and will include the enclosing parentheses. Other normalization (such as removing redundant parentheses or simplifying occurrence indicators) is at the discretion of the parser.
        */
        var model = this.nextCharRegExp(/>/);
        if (this.declarationHandler) {
            this.declarationHandler.elementDecl(name, model);
        }
        return true;
    }
    return false;
};

/*
[52]   	AttlistDecl	   ::=   	'<!ATTLIST' S  Name  AttDef* S? '>'
*/
SAXParser.prototype.scanAttlistDecl = function() {
    if (this.isFollowedBy("ATTLIST")) {
        this.nextChar();
        var eName = this.scanName();
        //initializes the attributesType map
        this.attributesType[eName] = {};
        this.nextChar();
        while (this.ch !== ">") {
            this.scanAttDef(eName);
        }
        return true;
    }
    return false;
};

/*
[53]   	AttDef	   ::=   	S Name S AttType S DefaultDecl
[60]   	DefaultDecl	   ::=   	'#REQUIRED' | '#IMPLIED'
			| (('#FIXED' S)? AttValue)
[10]    	AttValue	   ::=   	'"' ([^<&"] | Reference)* '"'
                                |  "'" ([^<&'] | Reference)* "'"
*/
SAXParser.prototype.scanAttDef = function(eName) {
    var aName = this.scanName();
    this.skipWhiteSpaces();
    var type = this.scanAttType();
    //stores the declared type of that attribute for method getType() of AttributesImpl
    this.attributesType[eName][aName] = type;
    this.skipWhiteSpaces();
    //DefaultDecl
    var mode = null;
    if (this.ch === "#") {
        mode = this.nextCharRegExp(new RegExp("[\t\n\r >]"));
        this.skipWhiteSpaces();
    }
    var attValue = null;
    if (mode === null || mode === "#FIXED") {
        //attValue
        //here % is included and parsed
        if (this.ch === "%") {
            this.includeParameterEntity();
        }
        if (this.ch === '"' || this.ch === "'") {
            var quote = this.ch;
            this.nextChar(true);
            attValue = this.nextCharRegExp(new RegExp("[" + quote + "<%]"));
            //if found a "%" must replace it, PeRef are replaced here but not EntityRef
            // Included in Literal here (not parsed as the literal can not be terminated by quote)
            while (this.ch === "%") {
                this.nextChar(true);
                var ref = this.scanPeRef();
                attValue += ref;
                attValue += this.nextCharRegExp(new RegExp("[" + quote + "<%]"));
            }
            if (this.ch === "<") {
                this.fireError("invalid attribute value, must not contain &lt;", FATAL);
            }
            //current char is ending quote
            this.nextChar();
        }
    }
    if (this.declarationHandler) {
        this.declarationHandler.attributeDecl(eName, aName, type, mode, attValue);
    }
};

/*
[54]   	AttType	   ::=   	 StringType | TokenizedType | EnumeratedType
[55]   	StringType	   ::=   	'CDATA'
[56]   	TokenizedType	   ::=   	'ID'	[VC: ID]
			| 'IDREF'	[VC: IDREF]
			| 'IDREFS'	[VC: IDREF]
			| 'ENTITY'	[VC: Entity Name]
			| 'ENTITIES'	[VC: Entity Name]
			| 'NMTOKEN'	[VC: Name Token]
			| 'NMTOKENS'	[VC: Name Token]
[57]   	EnumeratedType	   ::=   	 NotationType | Enumeration
[58]   	NotationType	   ::=   	'NOTATION' S '(' S? Name (S? '|' S? Name)* S? ')'
[59]   	Enumeration	   ::=   	'(' S? Nmtoken (S? '|' S? Nmtoken)* S? ')'
[7]   	           Nmtoken	   ::=   	(NameChar)+
*/
SAXParser.prototype.scanAttType = function() {
    var type;
    //Enumeration
    if (this.ch === "(") {
        this.nextChar();
        type = this.nextCharRegExp(NOT_START_OR_END_CHAR);
        //removes whitespaces between NOTATION, does not support the invalidity of whitespaces inside Name
        while (WS.test(this.ch)) {
            this.skipWhiteSpaces();
            type += this.nextCharRegExp(NOT_START_OR_END_CHAR);
        }
        if (this.ch !== ")") {
            this.fireError("Invalid character : [" + this.ch + "] in ATTLIST enumeration", ERROR);
            type += this.ch + this.nextCharRegExp(WS);
        }
        this.nextChar();
    //NotationType
    } else if (this.isFollowedBy("NOTATION")) {
        this.skipWhiteSpaces();
        if (this.ch === "(") {
            this.nextChar();
            type = this.scanName();
            this.skipWhiteSpaces();
            if (this.ch !== ")") {
                this.fireError("Invalid character : [" + this.ch + "] in ATTLIST enumeration", ERROR);
            }
            this.nextChar();
        } else {
            this.fireError("Invalid NOTATION, must be followed by '('", ERROR);
            this.nextCharRegExp(/>/);
        }
    // StringType | TokenizedType
    } else {
        type = this.nextCharRegExp(WS);
        if (!/^CDATA$|^ID$|^IDREF$|^IDREFS$|^ENTITY$|^ENTITIES$|^NMTOKEN$|^NMTOKENS$/.test(type)) {
            this.fireError("Invalid type : [" + type + "] defined in ATTLIST", ERROR);
        }
    }
    return type;
};

/*
[82]   	NotationDecl	   ::=   	'<!NOTATION' S  Name  S (ExternalID | PublicID) S? '>'
[83]   	PublicID	   ::=   	'PUBLIC' S  PubidLiteral
*/
SAXParser.prototype.scanNotationDecl = function() {
    if (this.isFollowedBy("NOTATION")) {
        this.skipWhiteSpaces();
        var name = this.scanName();
        this.skipWhiteSpaces();
        var externalId = new ExternalId();
        // here there may be only PubidLiteral after PUBLIC so can not use directly scanExternalId
        if (this.isFollowedBy("PUBLIC")) {
            this.skipWhiteSpaces();
            externalId.publicId = this.scanPubIdLiteral();
            this.skipWhiteSpaces();
            if (this.ch !== ">") {
                externalId.systemId = this.scanSystemLiteral();
                this.skipWhiteSpaces();
            }
        } else {
            this.scanExternalId(externalId);
        }
        if (this.declarationHandler) {
            this.declarationHandler.notationDecl(name, externalId.publicId, externalId.systemId);
        }
        return true;
    }
    return false;
};

/*
if called from an element parsing defaultPrefix would be ""
if called from an attribute parsing defaultPrefix would be null

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
SAXParser.prototype.getQName = function(defaultPrefix) {
    var name = this.scanName();
    var localName = name;
    if (name.indexOf(":") !== -1) {
        var splitResult = name.split(":");
        defaultPrefix = splitResult[0];
        localName = splitResult[1];
    }
    return new Sax_QName(defaultPrefix, localName);
};

SAXParser.prototype.scanElement = function() {
    var qName = this.getQName("");
    this.elementsStack.push(qName.qName);
    var atts = this.scanAttributes(qName);
    var namespaceURI = null;
    try {
        namespaceURI = this.namespaceSupport.getURI(qName.prefix);
    } catch(e) {
        //should be a PrefixNotFoundException but not specified so no hypothesis
        this.fireError("namespace of element : [" + qName.qName + "] not found", ERROR);
    }
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
    if (this.ch !== ">") {
        this.fireError("invalid element, must finish with &gt;", FATAL);
    } else {
        this.nextChar(true);
    }
    return true;
};

SAXParser.prototype.scanAttributes = function(qName) {
    var atts = new AttributesImpl();
    //namespaces declared at this step will be stored at one level of global this.namespaces
    this.namespaceSupport.pushContext();
    //same way, in all cases a baseUriAddition is recorded on each level
    var baseUriAddition = "";
    this.scanAttribute(qName, atts);
    //as namespaces are defined only after parsing all the attributes, adds the namespaceURI here
    var i = atts.getLength();
    while (i--) {
        var prefix = atts.getPrefix(i);
        var namespaceURI = null;
        try {
            namespaceURI = this.namespaceSupport.getURI(prefix);
        } catch(e) {
            this.fireError("namespace of attribute : [" + qName.qName + "] not found", ERROR);
        }
        atts.setURI(i, namespaceURI);
        //handling special xml: attributes
        if (namespaceURI === this.namespaceSupport.XMLNS) {
            switch (atts.getLocalName(i)) {
                case "base":
                    baseUriAddition = atts.getValue(i);
                    break;
                default:
                    break;
            }
        }
    }
    this.relativeBaseUris.push(baseUriAddition);
    return atts;
};

SAXParser.prototype.scanAttribute = function(qName, atts) {
    this.skipWhiteSpaces();
    if (this.ch !== ">" && this.ch !== "/") {
        var attQName = this.getQName(null);
        this.skipWhiteSpaces();
        if (this.ch === "=") {
            this.nextChar();
            var value = this.scanAttValue();
            if (attQName.prefix === "xmlns") {
                this.namespaceSupport.declarePrefix(attQName.localName, value);
                this.contentHandler.startPrefixMapping(attQName.localName, value);
            } else if (attQName.qName === "xmlns") {
                this.namespaceSupport.declarePrefix("", value);
                this.contentHandler.startPrefixMapping("", value);
            } else {
                //get the type of that attribute from internal DTD if found (no support of namespace in DTD)
                var type = null;
                var elementName = qName.localName;
                var elementMap = this.attributesType[elementName];
                if (elementMap) {
                    type = elementMap[attQName.localName];
                }
                //check that an attribute with the same qName has not already been defined
                if (atts.getIndex(attQName.qName) !== -1) {
                    this.fireError("multiple declarations for same attribute : [" + attQName.qName + "]", ERROR);
                } else {
                    //we do not know yet the namespace URI
                    atts.addPrefixedAttribute(undefined, attQName.prefix, attQName.localName, attQName.qName, type, value);
                }
            }
            this.scanAttribute(qName, atts);
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
            var attValue = this.nextCharRegExp(new RegExp("[" + quote + "<&]"));
            //if found a "&"
            while (this.ch === "&") {
                this.nextChar(true);
                try {
                    var ref = this.scanRef();
                    attValue += ref;
                } catch (e2) {
                    if (e2 instanceof InternalEntityNotFoundException) {
                        this.fireError("entity reference : [" + e2.entityName + "] not declared, ignoring it", ERROR);
                    } else {
                        throw e2;
                    }
                }
                attValue += this.nextCharRegExp(new RegExp("[" + quote + "<&]"));
            }
            if (this.ch === "<") {
                return this.fireError("invalid attribute value, must not contain &lt;", FATAL);
            }
            //current char is ending quote
            this.nextChar();
        //adding a message in that case
        } catch(e) {
            if (e instanceof EndOfInputException) {
                return this.fireError("document incomplete, attribute value declaration must end with a quote", FATAL);
            } else {
                throw e;
            }
        }
        return attValue;
    } else {
        return this.fireError("invalid attribute value declaration, must begin with a quote", FATAL);
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
        this.nextNChar(3);
        if (this.lexicalHandler) {
            this.lexicalHandler.endCDATA();
        }
        return true;
    } else {
        return false;
    }
};

// [66] CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
// current ch is char after "&#",  returned current char is after ";"
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
    //current char is ';'
    this.nextChar(true);
    return this.xml.substring(oldIndex, this.index);
};

/*
[68]  EntityRef ::= '&' Name ';'
may return undefined, has to be managed differently depending on
*/
SAXParser.prototype.scanEntityRef = function() {
    try {
        var ref = this.scanName();
        //current char must be ';'
        if (this.ch !== ";") {
            this.fireError("entity : [" + ref + "] contains an invalid character : [" + this.ch + "], or it is not ended by ;", ERROR);
            return "";
        }
        this.nextChar(true);
        if (this.lexicalHandler) {
            this.lexicalHandler.startEntity(ref);
            this.lexicalHandler.endEntity(ref);
        }
        // well-formed documents need not declare any of the following entities: amp, lt, gt, apos, quot.
        if (NOT_REPLACED_ENTITIES.test(ref)) {
            return "&" + ref + ";";
        }
        var replacement = this.entities[ref];
        if (replacement === undefined) {
            throw new InternalEntityNotFoundException(ref);
        }
        return replacement;
    //adding a message in that case
    } catch(e) {
        if (e instanceof EndOfInputException) {
            return this.fireError("document incomplete, entity reference must end with ;", FATAL);
        } else {
            throw e;
        }
    }
};

// [42] ETag ::= '</' Name S? '>'
SAXParser.prototype.scanEndingTag = function() {
    var qName = this.getQName("");
    var namespaceURI = null;
    try {
        namespaceURI = this.namespaceSupport.getURI(qName.prefix);
    } catch(e) {
        this.fireError("namespace of ending tag : [" + qName.qName + "] not found", ERROR);
    }
    var currentElement = this.elementsStack.pop();
    if (qName.qName === currentElement) {
        this.skipWhiteSpaces();
        if (this.ch === ">") {
            this.endMarkup(namespaceURI, qName);
            this.nextChar(true);
            return true;
        } else {
            return this.fireError("invalid ending markup, does not finish with &gt;", FATAL);
        }
    } else {
        return this.fireError("invalid ending markup : [" + qName.qName + "], markup name does not match current one : [" + currentElement + "]", FATAL);
    }
};


SAXParser.prototype.endMarkup = function(namespaceURI, qName) {
    this.contentHandler.endElement(namespaceURI, qName.localName, qName.qName);
    var namespacesRemoved = this.namespaceSupport.popContext();
    for (var i in namespacesRemoved) {
        this.contentHandler.endPrefixMapping(i);
    }
    this.relativeBaseUris.pop();
};


/*
if dontSkipWhiteSpace is not passed, then it is false so skipWhiteSpaces is default
if end of document, char is ''
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
    while (WS.test(this.ch)) {
        this.index++;
        if (this.index >= this.length) {
            throw new EndOfInputException();
        }
        this.ch = this.xml.charAt(this.index);
    }
};

/*
increases the token of 'n' chars
does not check for EndOfInputException as in general it is checked already
*/
SAXParser.prototype.nextNChar = function(numberOfChars) {
    this.index += numberOfChars;
    this.ch = this.xml.charAt(this.index);
};

/*
goes to next reg exp and return content, from current char to the char before reg exp
At end of the method, current char is first char of the regExp
*/
SAXParser.prototype.nextRegExp = function(regExp) {
    var oldIndex = this.index;
    var inc = this.xml.substr(this.index).search(regExp);
    if (inc === -1) {
        throw new EndOfInputException();
    } else {
        this.nextNChar(inc);
        return this.xml.substring(oldIndex, this.index);
    }
};

/*
memory usage reduction of nextRegExp, compares char by char, does not extract this.xml.substr(this.index)
for flexibility purpose, current char at end of that method is the character of the regExp found in xml
*/
SAXParser.prototype.nextCharRegExp = function(regExp, continuation) {
    for (var oldIndex = this.index ; this.index < this.length ; this.index++) {
        this.ch = this.xml.charAt(this.index);
        if (regExp.test(this.ch)) {
            if (continuation && continuation.pattern.test(this.ch)) {
                return continuation.cb.call(this);
            }
            return this.xml.substring(oldIndex, this.index);
        }
    }
    throw new EndOfInputException();
};

/*

*/
SAXParser.prototype.isFollowedBy = function(str) {
    var length = str.length;
    if (this.xml.substr(this.index, length) === str) {
        this.nextNChar(length);
        return true;
    }
    return false;
};

/*
[4]   	NameStartChar	   ::=   	":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
[4a]   	NameChar	   ::=   	NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
[5]   	Name	   ::=   	NameStartChar (NameChar)*
*/
SAXParser.prototype.scanName = function() {
    if (NOT_START_CHAR.test(this.ch)) {
        this.fireError("invalid starting character in Name : [" + this.ch + "]", FATAL);
        return "";
    }
    var name = this.ch;
    this.nextChar(true);
    name += this.nextCharRegExp(NOT_START_OR_END_CHAR);
    return name;
};


SAXParser.prototype.nextGT = function() {
    var content = this.nextCharRegExp(/>/);
    this.index++;
    this.ch = this.xml.charAt(this.index);
    return content;
};

SAXParser.prototype.nextEndPI = function() {
    var content = this.nextRegExp(/\?>/);
    this.nextNChar(2);
    return content;
};

/*
goes after ' or " and return content
current char is opening ' or "
*/
SAXParser.prototype.quoteContent = function() {
    this.index++;
    var content = this.nextCharRegExp(new RegExp(this.ch));
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
        return false;
    } else if (gravity === FATAL) {
        this.errorHandler.fatalError(saxParseException);
        return false;
    }
    return true;
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


// Add public API to global namespace (or other one, if we are in another)
this.SAXParser = SAXParser; // To avoid introducing any of our own to the namespace, this could be commented out, and require use of XMLReaderFactory.createXMLReader(); to get a parser

// Could put on org.xml.sax.
this.SAXException = SAXException;
this.SAXNotSupportedException = SAXNotSupportedException;
this.SAXNotRecognizedException = SAXNotRecognizedException;
this.SAXParseException = SAXParseException;

// Could put on org.xml.sax.helpers.
this.XMLReaderFactory = XMLReaderFactory;

}()); // end namespace
