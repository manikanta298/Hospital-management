import { useState } from 'react';
import { api } from '../api.js';
import { useAction, useForm, useLoad } from '../hooks.js';
import { useApp } from '../context.jsx';
import { Btn, Card, ConfirmBtn, Fields, FormActions, Load, Page, Table } from './ui.jsx';

// "List + add/edit form on the same page" screen, used for the many small lookup tables.
//  props: title, listUrl, listKey, columns(data,{edit,reload}), fields, blank, createUrl, updateUrl(row), deleteUrl(row),
//         canAdd, canUpdate, canDelete (permission names), fieldsFor(data) -> extra/override fields, toBody(values), intro, extra(data)
export default function Crud({ title, listUrl, listKey, columns, fields, fieldsFor, blank = {}, createUrl, updateUrl, deleteUrl, canAdd, canUpdate, canDelete, toBody, intro, extra, params, cols = 2, rowLabel = 'row', hideForm }) {
  const app = useApp(); const state = useLoad(listUrl, params, []); const { run, busy, errors, setErrors } = useAction();
  const form = useForm(blank); const [editing, setEditing] = useState(null);
  const reset = () => { form.setValues(blank); setEditing(null); setErrors({}); };
  const edit = (row) => { setEditing(row); form.setValues({ ...blank, ...row }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const submit = async (e) => {
    e.preventDefault(); const body = toBody ? toBody(form.values) : form.values;
    const r = await run(() => (editing ? api.put(updateUrl(editing), body) : api.post(createUrl, body)));
    if (r) { reset(); state.reload(); }
  };
  const remove = async (row) => { const r = await run(() => api.del(deleteUrl(row))); if (r) { if (editing && editing.id === row.id) reset(); state.reload(); } };
  const allowed = (p) => !p || app.can(p);
  return (
    <Page title={title}>
      <Load state={state}>{(data) => {
        const rows = data[listKey] || []; const f = fieldsFor ? fieldsFor(data, editing) : fields;
        return (
          <>
            {intro && <div className="alert alert-info">{intro}</div>}
            {!hideForm && ((editing && allowed(canUpdate)) || (!editing && allowed(canAdd))) && (
              <Card title={editing ? `Edit ${rowLabel}` : `Add ${rowLabel}`}>
                <form onSubmit={submit}><Fields fields={f} form={form} errors={errors} cols={cols} />
                  <FormActions><Btn kind="primary" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Add'}</Btn>{editing && <Btn onClick={reset}>Cancel</Btn>}</FormActions></form>
              </Card>
            )}
            <Card>
              <Table rows={rows} columns={[...columns(data, { edit, reload: state.reload }), ...(deleteUrl || updateUrl ? [{ label: '', className: 'right nowrap', render: (r) => (
                <>{updateUrl && allowed(canUpdate) && <Btn size="sm" onClick={() => edit(r)}>Edit</Btn>} {deleteUrl && allowed(canDelete) && <ConfirmBtn message={`Delete this ${rowLabel}?`} onConfirm={() => remove(r)}>Delete</ConfirmBtn>}</>) }] : [])]} />
            </Card>
            {extra && extra(data, state.reload)}
          </>
        );
      }}</Load>
    </Page>
  );
}
