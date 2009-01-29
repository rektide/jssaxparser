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
    
    this.startDocument = function() {
        div.innerHTML += "startDocument<br/>";
    };
    
    this.startElement = function(namespaceURI, localName, qName, atts) {
        div.innerHTML += "startElement [" + namespaceURI + "] [" + localName + "] [" + qName + "]<br/>";
        this.displayAtts(atts);
    };
    
    this.endElement = function(namespaceURI, localName, qName) {
        div.innerHTML += "endElement [" + namespaceURI + "] [" + localName + "] [" + qName + "]<br/>";
    };
    
    this.startPrefixMapping = function(prefix, uri) {
        div.innerHTML += "startPrefixMapping [" + prefix + "] [" + uri + "]<br/>";
    };
    
    this.endPrefixMapping = function(prefix) {
        div.innerHTML += "endPrefixMapping [" + prefix + "]<br/>";
    };
    
    this.processingInstruction = function(target, data) {
        div.innerHTML += "processingInstruction [" + target + "] [" + data + "]<br/>";
    };
    
    this.ignorableWhitespace = function(ch, start, length) {
        div.innerHTML += "ignorableWhitespace [" + ch + "] [" + start + "] [" + length + "]<br/>";
    };
    
    this.characters = function(ch, start, length) {
        div.innerHTML += "characters [" + ch + "] [" + start + "] [" + length + "]<br/>";
    };
    
    this.skippedEntity = function(name) {
        div.innerHTML += "skippedEntity [" + name + "]<br/>";
    };
    
    this.endDocument = function() {
        div.innerHTML += "endDocument";
    };
    
    this.displayAtts = function(atts) {
        for (i in atts) {
            div.innerHTML += "[" + i + "] [" + atts[i] + "]<br/>";
        }
    };
    
    this.warning = function(saxException) {
        this.serializeSaxException(saxException);
    };
    this.error = function(saxException) {
        this.serializeSaxException(saxException);
    };
    this.fatalError = function(saxException) {
        this.serializeSaxException(saxException);
    };
    
    this.serializeSaxException = function(saxException) {
        div.innerHTML += "invalid char : [" + saxException.char + "] at index : " + saxException.index + "<br/>";
        div.innerHTML += "message is : [" + saxException.message + "]<br/>";
        if (saxException.exception) {
            div.innerHTML += "wrapped exception is : [" + this.serializeSaxException(saxException.exception) + "]<br/>";
        }
    }
    
}