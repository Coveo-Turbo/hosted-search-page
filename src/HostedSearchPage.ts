
const template = document.createElement('template');
template.innerHTML = `<div id="hostedSearchPage"></div>`;

interface IHostedSearchPageAsset {
  InlineContent: string,
  Name: string,
  URL: string
}

interface IHostedSearchPage {
  id: string,
  name: string,
  title: string,
  lastModified: string,
  html: string,
  css: Array<IHostedSearchPageAsset>,
  javascript: Array<IHostedSearchPageAsset>
}

export interface IHostedSearchPageOptions {
  orgId: string,
  pageId: string,
  apiKey: string,
  htmlOnly?: boolean,
  restUri?: string
}

export interface IHostedSearchPageState {
  scriptsLoaded: number,
  inlineScriptsInjected: number,
  error: string
}

export class HostedSearchPage extends HTMLElement {
  private _state: IHostedSearchPageState;
  private _options: IHostedSearchPageOptions = {
    orgId:'',
    pageId: '',
    apiKey: '',
    htmlOnly: false,
    restUri: 'https://platform.cloud.coveo.com'
  };
  private _searchPage: HTMLElement;
  private _searchPageScripts: Array<IHostedSearchPageAsset>;
  private _searchPageStyles: Array<IHostedSearchPageAsset>;
  private _root: HTMLElement|ShadowRoot;
  private _attachShadow: boolean;

  constructor() {
    super();
  }

  connectedCallback() {
    this._attachShadow = this.getAttribute('attachShadow') && this.getAttribute('attachShadow') == 'true';
    if(!this._attachShadow) {
      this._root = this;
    } else {
      this.attachShadow({mode: 'open'});
      this._root = this.shadowRoot; 
    }

    this._root.appendChild(template.content.cloneNode(true));
    this.searchPage = this._root.querySelector('#hostedSearchPage');
    this.state = {
      scriptsLoaded: 0,
      inlineScriptsInjected:0,
      error: ''
    }
  }

  getModel(): Promise<void> {
    const {orgId, pageId, apiKey, restUri } = this._options;
    return new Promise<void>((res, rej) => {
      fetch(`${restUri}/rest/organizations/${orgId}/pages/${pageId}`, {
        headers: new Headers({
          'Authorization': `Bearer ${apiKey}`
        })
      })
        .then(data => data.json())
        .then((json) => {
          this.renderSearchPage(json);
          res();
        })
        .catch((error) => rej(error));
    })
  }

  public configure(options: IHostedSearchPageOptions): Promise<void>{
    this.options = options;
    return this.getModel();
  }

  private renderSearchPage(data: IHostedSearchPage){
    this.searchPage.innerHTML = data.html;
    if(!this.options.htmlOnly){
      this.addScriptFiles(data);
      this.addStyleFiles(data);
    }
  }

  private addScriptFiles(data: IHostedSearchPage) {
    if (data.javascript) {
      this._searchPageScripts = data.javascript.filter(script => script.Name.indexOf('InterfaceEditor') < 0);
      this._searchPageScripts.forEach(script => {
        const element = document.createElement('script');
        element.type = 'text/javascript';
        if (script.URL){
          element.src = script.URL;
          element.async = false;
          if(script.Name === 'CoveoSearchUI') {
            element.classList.add('coveo-script')
          }
          element.addEventListener('load', () => {
              this.state = {
                  scriptsLoaded: this.state.scriptsLoaded + 1,
                  inlineScriptsInjected: this.state.inlineScriptsInjected,
                  error: this.state.error
              };
              this.coveoExternalScriptsLoaded();
          }, { once: true });
          this._attachShadow ? this._root.insertBefore(element, this._searchPage) : document.head.appendChild(element);
        } else {
          document.addEventListener('CoveoExternalScriptsLoaded', () => {
            element.insertAdjacentHTML('beforeend', script.InlineContent);
            this._attachShadow ? this._root.insertBefore(element, this._searchPage) : document.head.appendChild(element);
            this.state = {
                scriptsLoaded: this.state.scriptsLoaded,
                inlineScriptsInjected: this.state.inlineScriptsInjected + 1,
                error: this.state.error
            };
            this.coveoScriptsLoaded();
          })
        }
      });
    }
  }

  private addStyleFiles(data: IHostedSearchPage) {
    if (data.css) {
      this._searchPageStyles = data.css.filter(css => css.Name.indexOf('InterfaceEditor') < 0);
      this._searchPageStyles.forEach(css => {
        if (css.URL){
          const element = document.createElement('link');
          element.href = css.URL;
          element.rel="stylesheet";
          element.id = css.Name;
          this._attachShadow ? this._root.insertBefore(element, this._searchPage) : document.head.appendChild(element);
          
        } else {
          const inlineElement = document.createElement('style');
          inlineElement.insertAdjacentHTML('beforeend', css.InlineContent);
          this._attachShadow ? this._root.insertBefore(inlineElement, this._searchPage) : document.head.appendChild(inlineElement);
        }
      });
    }
  }

  private coveoExternalScriptsLoaded() {
      if (this.state.scriptsLoaded === this._searchPageScripts.filter(s => s.URL).length) {
        document.dispatchEvent(new CustomEvent("CoveoExternalScriptsLoaded"));
      }
  }

  private coveoScriptsLoaded() {
      if (this.state.inlineScriptsInjected === this._searchPageScripts.filter(s => s.InlineContent).length) {
        document.dispatchEvent(new CustomEvent("CoveoScriptsLoaded"));
      }
  }
  
  // static get observedAttributes() {
  //   // Indicate that we want to be notified
  //   // when the `options` attribute is changed
  //   return ['enableShadow'];
  // }

  // attributeChangedCallback(attrName, oldVal, newVal) {
  //   if (oldVal != newVal) {
  //     // If the value for the `groupName` attribute has changed
  //     // then insert the value into the `<label>`
  //     this.options.enableShadow = newVal || true;
  //     // OR: this._span.innerHTML = newVal || 'no value';
  //     // But make sure someone has not tried to hit you
  //     // with a script attack.
  //   }
  // }

  get options() {
    return this._options;
  }
  set options(newOptions) {
    this._options = Object.assign(this._options || {}, newOptions);
  }

  get state() {
    return this._state;
  }
  set state(newState) {
    this._state = newState;
  }

  get searchPage() {
    return this._searchPage;
  }
  set searchPage(newSearchPage) {
    this._searchPage = newSearchPage;
  }
}

//customElements.define does not gracefully handle duplicate declarations.
if (!customElements.get('hosted-search-page')) {
  customElements.define('hosted-search-page', HostedSearchPage); 
}