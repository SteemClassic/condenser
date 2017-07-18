import React from 'react';
import {connect} from 'react-redux'
import user from 'app/redux/User';
import tt from 'counterpart';
import {ALLOWED_CURRENCIES} from 'app/client_config'
import store from 'store';
import transaction from 'app/redux/Transaction'
import o2j from 'shared/clash/object2json'
import LoadingIndicator from 'app/components/elements/LoadingIndicator'
import Userpic from 'app/components/elements/Userpic';
import reactForm from 'app/utils/ReactForm'
import UserList from 'app/components/elements/UserList';
import Dropzone from 'react-dropzone';


class Settings extends React.Component {

    constructor(props) {
        super()
        this.initForm(props)
        this.onNsfwPrefChange = this.onNsfwPrefChange.bind(this)
        this.onNsfwPrefSubmit = this.onNsfwPrefSubmit.bind(this)
    }

    state = {
        errorMessage: '',
        successMessage: '',
        progress: {}
    }

    initForm(props) {
        reactForm({
            instance: this,
            name: 'accountSettings',
            fields: ['profile_image', 'name', 'about', 'location', 'website'],
            initialValues: props.profile,
            validation: values => ({
                profile_image: values.profile_image && !/^https?:\/\//.test(values.profile_image) ? tt('settings_jsx.invalid_url') : null,
                name: values.name && values.name.length > 20 ? tt('settings_jsx.name_is_too_long') : values.name && /^\s*@/.test(values.name) ? tt('settings_jsx.name_must_not_begin_with') : null,
                about: values.about && values.about.length > 160 ? tt('settings_jsx.about_is_too_long') : null,
                location: values.location && values.location.length > 30 ? tt('settings_jsx.location_is_too_long') : null,
                website: values.website && values.website.length > 100 ? tt('settings_jsx.website_url_is_too_long') : values.website && !/^https?:\/\//.test(values.website) ? tt('settings_jsx.invalid_url') : null,
            })
        })
        this.handleSubmitForm =
            this.state.accountSettings.handleSubmit(args => this.handleSubmit(args))
    }

    componentWillMount() {
        const {accountname} = this.props
        const nsfwPref = (process.env.BROWSER ? localStorage.getItem('nsfwPref-' + accountname) : null) || 'warn'
        this.setState({nsfwPref, oldNsfwPref: nsfwPref})
    }

    onNsfwPrefChange(e) {
        const nsfwPref = e.currentTarget.value;
        this.setState({nsfwPref: nsfwPref})
    }

    onNsfwPrefSubmit(e) {
        const {accountname} = this.props;
        const {nsfwPref} = this.state;
        localStorage.setItem('nsfwPref-'+accountname, nsfwPref)
        this.setState({oldNsfwPref: nsfwPref})
    }

    handleSubmit = ({updateInitialValues}) => {
        let {metaData} = this.props
        if (!metaData) metaData = {}
        if(!metaData.profile) metaData.profile = {}
        delete metaData.user_image; // old field... cleanup

        const {profile_image, name, about, location, website} = this.state

        // Update relevant fields
        metaData.profile.profile_image = profile_image.value
        metaData.profile.name = name.value
        metaData.profile.about = about.value
        metaData.profile.location = location.value
        metaData.profile.website = website.value

        // Remove empty keys
        if(!metaData.profile.profile_image) delete metaData.profile.profile_image;
        if(!metaData.profile.name) delete metaData.profile.name;
        if(!metaData.profile.about) delete metaData.profile.about;
        if(!metaData.profile.location) delete metaData.profile.location;
        if(!metaData.profile.website) delete metaData.profile.website;

        // TODO: Update language & currency
        //store.set('language', language)
        //this.props.changeLanguage(language)
        //store.set('currency', event.target.value)

        const {account, updateAccount} = this.props
        this.setState({loading: true})
        updateAccount({
            json_metadata: JSON.stringify(metaData),
            account: account.name,
            memo_key: account.memo_key,
            errorCallback: (e) => {
                if (e === 'Canceled') {
                    this.setState({
                        loading: false,
                        errorMessage: ''
                    })
                } else {
                    console.log('updateAccount ERROR', e)
                    this.setState({
                        loading: false,
                        changed: false,
                        errorMessage: tt('g.server_returned_error')
                    })
                }
            },
            successCallback: () => {
                this.setState({
                    loading: false,
                    changed: false,
                    errorMessage: '',
                    successMessage: tt('g.saved') + '!',
                })
                // remove successMessage after a while
                setTimeout(() => this.setState({successMessage: ''}), 4000)
                updateInitialValues()
            }
        })
    }

    onDrop = (acceptedFiles, rejectedFiles) => {
        if(!acceptedFiles.length) {
            if(rejectedFiles.length) {
                this.setState({progress: {error: 'Please insert only image files.'}})
                console.log('onDrop Rejected files: ', rejectedFiles);
            }
            return
        }
        const file = acceptedFiles[0]
        this.upload(file, file.name)
    }

    onOpenClick = () => {
        this.dropzone.open();
    }

    onPasteCapture = e => {
        try {
            if(e.clipboardData) {
                for(const item of e.clipboardData.items) {
                    if(item.kind === 'file' && /^image\//.test(item.type)) {
                        const blob = item.getAsFile()
                        this.upload(blob)
                    }
                }
            } else {
                // http://joelb.me/blog/2011/code-snippet-accessing-clipboard-images-with-javascript/
                // contenteditable element that catches all pasted data
                this.setState({noClipboardData: true})
            }
        } catch(error) {
            console.error('Error analyzing clipboard event', error);
        }
    }

    upload = (file, name = '') => {
        const {uploadImage} = this.props
        this.setState({progress: {message: 'Uploading...'}})
        uploadImage(file, progress => {
            if(progress.url) {
                this.setState({ progress: {} })
                const {url} = progress
                const image_md = `${url}`
                const {body} = this.state
                const {selectionStart, selectionEnd} = this.refs.postRef
                profile_image.props.onChange(
                    image_md
                )
            } else {
                this.setState({ progress })
            }
            setTimeout(() => { this.setState({ progress: {} }) }, 4000) // clear message
        })
    }

    render() {
        const {state, props} = this

        const {submitting, valid, touched} = this.state.accountSettings
        const disabled = !props.isOwnAccount || state.loading || submitting || !valid || !touched

        const {profile_image, name, about, location, website} = this.state

        const {follow, account, isOwnAccount} = this.props
        const following = follow && follow.getIn(['getFollowingAsync', account.name]);
        const ignores = isOwnAccount && following && following.get('ignore_result')

        const {progress, noClipboardData} = this.state

        return <div className="Settings">

            {/*<div className="row">
                <div className="small-12 medium-6 large-4 columns">
                    <label>{tt('g.choose_language')}
                        <select defaultValue={store.get('language')} onChange={this.handleLanguageChange}>
                            <option value="en">English</option>
                            <option value="ru">Russian</option>
                            <option value="es">Spanish</option>
                            <option value="es-AR">Spanish (Argentina)</option>
                            <option value="fr">French</option>
                            <option value="it">Italian</option>
                            <option value="jp">Japanese</option>
                        </select>
                    </label>
                </div>
            </div>*/}
            {/*<div className="row">
                <div className="small-12 medium-6 large-4 columns">
                    <label>{tt('g.choose_currency')}
                        <select defaultValue={store.get('currency')} onChange={this.handleCurrencyChange}>
                            {
                                ALLOWED_CURRENCIES.map(i => {
                                    return <option key={i} value={i}>{i}</option>
                                })
                            }
                        </select>
                    </label>
                </div>
            </div>*/}
            <div className="row">
                <form onSubmit={this.handleSubmitForm} className="small-12 medium-6 large-4 columns">
                    <h4>{tt('settings_jsx.public_profile_settings')}</h4>
                    <label>
                        {tt('settings_jsx.profile_image_url')}
                        <Dropzone onDrop={this.onDrop}
                          className="dropzone"
                          disableClick multiple={false} accept="image/*"
                          ref={(node) => { this.dropzone = node; }}>
                            <input type="url" {...profile_image.props} autoComplete="off" />
                            <span>

                                <p className="drag-and-drop">
                                    Insert images by dragging &amp; dropping,&nbsp;
                                    {noClipboardData ? '' : 'pasting from the clipboard, '}
                                    or by <a onClick={this.onOpenClick}>selecting them</a>.
                                </p>
                                {progress.message && <div className="info">{progress.message}</div>}
                                {progress.error && <div className="error">Image upload: {progress.error}</div>}
                            </span>
                        </Dropzone>
                    </label>
                    <div className="error">{profile_image.blur && profile_image.touched && profile_image.error}</div>

                    <label>
                        {tt('settings_jsx.profile_name')}
                        <input type="text" {...name.props} maxLength="20" autoComplete="off" />
                    </label>
                    <div className="error">{name.touched && name.error}</div>

                    <label>
                        {tt('settings_jsx.profile_about')}
                        <input type="text" {...about.props} maxLength="160" autoComplete="off" />
                    </label>
                    <div className="error">{about.touched && about.error}</div>

                    <label>
                        {tt('settings_jsx.profile_location')}
                        <input type="text" {...location.props} maxLength="30" autoComplete="off" />
                    </label>
                    <div className="error">{location.touched && location.error}</div>

                    <label>
                        {tt('settings_jsx.profile_website')}
                        <input type="url" {...website.props} maxLength="100" autoComplete="off" />
                    </label>
                    <div className="error">{website.blur && website.touched && website.error}</div>

                    <br />
                    {state.loading && <span><LoadingIndicator type="circle" /><br /></span>}
                    {!state.loading && <input type="submit" className="button" value={tt('settings_jsx.update')} disabled={disabled} />}
                    {' '}{
                            state.errorMessage
                                ? <small className="error">{state.errorMessage}</small>
                                : state.successMessage
                                ? <small className="success uppercase">{state.successMessage}</small>
                                : null
                        }
                </form>
            </div>

            {isOwnAccount &&
                <div className="row">
                    <div className="small-12 medium-6 large-4 columns">
                        <br /><br />
                        <h4>{tt('settings_jsx.private_post_display_settings')}</h4>
                        <div>
                            {tt('settings_jsx.not_safe_for_work_nsfw_content')}
                        </div>
                        <select value={this.state.nsfwPref} onChange={this.onNsfwPrefChange}>
                            <option value="hide">{tt('settings_jsx.always_hide')}</option>
                            <option value="warn">{tt('settings_jsx.always_warn')}</option>
                            <option value="show">{tt('settings_jsx.always_show')}</option>
                        </select>
                        <br />
                        <br />
                        <input type="submit" onClick={this.onNsfwPrefSubmit} className="button" value={tt('settings_jsx.update')} disabled={this.state.nsfwPref == this.state.oldNsfwPref} />
                        <div>&nbsp;</div>
                    </div>
                </div>}
            {ignores && ignores.size > 0 &&
                <div className="row">
                    <div className="small-12 medium-6 large-4 columns">
                        <br /><br />
                        <UserList title={tt('settings_jsx.muted_users')} account={account} users={ignores} />
                    </div>
                </div>}
        </div>
    }
}

export default connect(
    // mapStateToProps
    (state, ownProps) => {
        const {accountname} = ownProps.routeParams
        const account = state.global.getIn(['accounts', accountname]).toJS()
        const current_user = state.user.get('current')
        const username = current_user ? current_user.get('username') : ''
        let metaData = account ? o2j.ifStringParseJSON(account.json_metadata) : {}
        if (typeof metaData === 'string') metaData = o2j.ifStringParseJSON(metaData); // issue #1237
        const profile = metaData && metaData.profile ? metaData.profile : {}

        return {
            account,
            metaData,
            accountname,
            isOwnAccount: username == accountname,
            profile,
            follow: state.global.get('follow'),
            ...ownProps
        }
    },
    // mapDispatchToProps
    dispatch => ({
        changeLanguage: (language) => {
            dispatch(user.actions.changeLanguage(language))
        },
        updateAccount: ({successCallback, errorCallback, ...operation}) => {
            const options = {type: 'account_update', operation, successCallback, errorCallback}
            dispatch(transaction.actions.broadcastOperation(options))
        },
        uploadImage: (file, progress) => {
            dispatch({
                type: 'user/UPLOAD_IMAGE',
                payload: {file, progress},
            })
        }
    })
)(Settings)
