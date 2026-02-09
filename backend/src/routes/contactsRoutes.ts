import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate, uuidParamSchema, createContactSchema, updateContactSchema, linkContactPropertySchema } from '../middleware/validate';
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  linkContactProperty,
  unlinkContactProperty,
} from '../controllers/contactsController';

const router = Router();

router.get('/', authenticate, listContacts);
router.get('/:id', authenticate, validate(uuidParamSchema, 'params'), getContact);
router.post('/', authenticate, validate(createContactSchema, 'body'), createContact);
router.patch('/:id', authenticate, validate(uuidParamSchema, 'params'), validate(updateContactSchema, 'body'), updateContact);
router.delete('/:id', authenticate, validate(uuidParamSchema, 'params'), deleteContact);

// Contact-Property linking
router.post('/:id/properties', authenticate, validate(uuidParamSchema, 'params'), validate(linkContactPropertySchema, 'body'), linkContactProperty);
router.delete('/:id/properties/:linkId', authenticate, unlinkContactProperty);

export default router;
