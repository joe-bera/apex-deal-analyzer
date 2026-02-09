import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
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

router.get('/', optionalAuth, listContacts);
router.get('/:id', optionalAuth, validate(uuidParamSchema, 'params'), getContact);
router.post('/', optionalAuth, validate(createContactSchema, 'body'), createContact);
router.patch('/:id', optionalAuth, validate(uuidParamSchema, 'params'), validate(updateContactSchema, 'body'), updateContact);
router.delete('/:id', optionalAuth, validate(uuidParamSchema, 'params'), deleteContact);

// Contact-Property linking
router.post('/:id/properties', optionalAuth, validate(uuidParamSchema, 'params'), validate(linkContactPropertySchema, 'body'), linkContactProperty);
router.delete('/:id/properties/:linkId', optionalAuth, unlinkContactProperty);

export default router;
